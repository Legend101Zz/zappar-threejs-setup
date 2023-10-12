import * as THREE from 'three'
import * as ZapparThree from '@zappar/zappar-threejs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import TWEEN from '@tweenjs/tween.js'

if (ZapparThree.browserIncompatible()) {
    // The browserIncompatibleUI() function shows a full-page dialog that informs the user
    // they're using an unsupported browser, and provides a button to 'copy' the current page
    // URL so they can 'paste' it into the address bar of a compatible alternative.
    ZapparThree.browserIncompatibleUI()

    // If the browser is not compatible, we can avoid setting up the rest of the page
    // so we throw an exception here.
    throw new Error('Unsupported browser')
}

const scene = new THREE.Scene()
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const manager = new ZapparThree.LoadingManager()
// Use this function to set your context
ZapparThree.glContextSet(renderer.getContext())

// Create a camera and set the scene background to the camera's backgroundTexture
let camera = new ZapparThree.Camera()
scene.background = camera.backgroundTexture

// Request camera permissions and start the camera
ZapparThree.permissionRequestUI().then((granted) => {
    if (granted) camera.start()
    else ZapparThree.permissionDeniedUI()
})

// Create a FaceTracker and a FaceAnchorGroup from it to put Three content in
// Pass our loading manager to the loader to ensure that the progress bar
// works correctly
const faceTracker = new ZapparThree.FaceTrackerLoader(manager).load()
const faceTrackerGroup = new ZapparThree.FaceAnchorGroup(camera, faceTracker)
// Add our face tracker group into the ThreeJS scene
scene.add(faceTrackerGroup)

// Start with the content group invisible
faceTrackerGroup.visible = false

// We want the user's face to appear in the center of the helmet
// so use ZapparThree.HeadMaskMesh to mask out the back of the helmet.
// In addition to constructing here we'll call mask.updateFromFaceAnchorGroup(...)
// in the frame loop later.
const mask = new ZapparThree.HeadMaskMeshLoader().load()
faceTrackerGroup.add(mask)

// Load a 3D model to place within our group (using ThreeJS's GLTF loader)
// Pass our loading manager in to ensure the progress bar works correctly

const gltfLoader = new GLTFLoader(manager)
gltfLoader.load(
    'models/gloves.glb',
    (gltf) => {
        gltf.scene.scale.set(2, 2, 2)
        gltf.scene.position.set(0, -0.7, 1)
        gltf.scene.rotation.set(Math.PI / 2, 0, 0)
        console.log(gltf.scene)
        gltf.scene.name = 'glove'
        // Add the scene to the tracker group
        gltf.scene.traverse(function (child) {
            if ((child as THREE.Mesh).isMesh) {
                let m = child as THREE.Mesh
                //m.castShadow = true
                m.frustumCulled = false
            }
        })
        faceTrackerGroup.add(gltf.scene)
    },
    undefined,
    () => {
        console.log('An error ocurred loading the GLTF model')
    }
)

// And then a little ambient light to brighten the model up a bit
const ambientLight = new THREE.AmbientLight('white', 0.4)
scene.add(ambientLight)

// Hide the 3D content when the face is out of view
faceTrackerGroup.faceTracker.onVisible.bind(() => {
    faceTrackerGroup.visible = true
})
faceTrackerGroup.faceTracker.onNotVisible.bind(() => {
    faceTrackerGroup.visible = false
})

// Create a cricket ball
const cricketBallGeometry = new THREE.SphereGeometry(0.2, 32, 32)
const cricketBallTextureLoader = new THREE.TextureLoader()
const cricketBallTexture = cricketBallTextureLoader.load('images/ball.png') // Adjust the path to your texture
const cricketBallMaterial = new THREE.MeshBasicMaterial({ map: cricketBallTexture })
const cricketBall = new THREE.Mesh(cricketBallGeometry, cricketBallMaterial)
const glove = faceTrackerGroup.getObjectByName('name')
// Set the initial position of the cricket ball
if (glove) {
    console.log('in glove')
    cricketBall.position.set(glove.position.x, glove.position.y, glove.position.z)
} else {
    cricketBall.position.set(-0.7657464742660522, 0.06717102974653244, -3.1538567543029785)
}

// Adjust the initial position as needed
scene.add(cricketBall)

// Create 6 ball icons
const ballGeometry = new THREE.SphereGeometry(0.1, 32, 32)
const ballMaterial = new THREE.MeshBasicMaterial({ map: cricketBallTexture })

for (let i = 0; i < 6; i++) {
    const ball = new THREE.Mesh(ballGeometry, ballMaterial)
    ball.position.set(-0.7657464742660522 + 0.3 * i, 0.66717102974653244, -3.1538567543029785)
    scene.add(ball)
}

// Function to animate the cricket ball
function throwCricketBall() {
    console.log('ball is thrown')
    const initialPosition = {
        x: -0.7657464742660522,
        y: 0.06717102974653244,
        z: -3.1538567543029785,
    } // Initial position
    const targetPosition = { x: 0, y: -2, z: 0 } // Target position

    const throwDuration = 2000 // Animation duration in milliseconds

    const cricketBallAnimation = new TWEEN.Tween(initialPosition)
        .to(targetPosition, throwDuration)
        .easing(TWEEN.Easing.Quadratic.Out) // Adjust the easing function as needed
        .onUpdate(() => {
            cricketBall.position.set(initialPosition.x, initialPosition.y, initialPosition.z)
        })
        .onComplete(() => {
            // Animation complete, you can add further actions here
            console.log('ball thrown')
        })

    cricketBallAnimation.start()
}

// Call the throwCricketBall function to start the animation

const throwButton = document.getElementById('throwButton')

// Add an event listener to the button
if (throwButton)
    throwButton.addEventListener('click', () => {
        // Call the throwCricketBall function when the button is clicked
        throwCricketBall()
    })

window.addEventListener('resize', onWindowResize, false)
console.log('scene', scene)
function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

function animate() {
    requestAnimationFrame(animate)
    // Rotate the balls (for example)
    scene.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
            child.rotation.x += 0.01
            child.rotation.y += 0.01
        }
    })
    camera.updateFrame(renderer)
    mask.updateFromFaceAnchorGroup(faceTrackerGroup)
    TWEEN.update()
    render()
}

function render() {
    renderer.render(scene, camera)
}
animate()
