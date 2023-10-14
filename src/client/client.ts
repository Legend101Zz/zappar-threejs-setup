import * as THREE from 'three'
import * as ZapparThree from '@zappar/zappar-threejs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import TWEEN from '@tweenjs/tween.js'
import * as CANNON from 'cannon-es'
import CannonUtils from './utils/canonUtils'
import CannonDebugRenderer from './utils/cannonDebugRenderer'

if (ZapparThree.browserIncompatible()) {
    // The browserIncompatibleUI() function shows a full-page dialog that informs the user
    // they're using an unsupported browser, and provides a button to 'copy' the current page
    // URL so they can 'paste' it into the address bar of a compatible alternative.
    ZapparThree.browserIncompatibleUI()

    // If the browser is not compatible, we can avoid setting up the rest of the page
    // so we throw an exception here.
    throw new Error('Unsupported browser')
}

let updateBoundingBoxes: () => void
let checkCollisions: () => void
let throwCricketBall: (obj: any) => void

const scene = new THREE.Scene()
const world = new CANNON.World()
world.gravity.set(0, -9.82, 0)
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

// Hide the 3D content when the face is out of view
faceTrackerGroup.faceTracker.onVisible.bind(() => {
    faceTrackerGroup.visible = true
})
faceTrackerGroup.faceTracker.onNotVisible.bind(() => {
    faceTrackerGroup.visible = false
})

// Create a cricket balls

const cricketBallTextureLoader = new THREE.TextureLoader()
const cricketBallTexture1 = cricketBallTextureLoader.load('images/ball.png')
const cricketBallTexture2 = cricketBallTextureLoader.load('images/ball2.png')
const cricketBallTexture3 = cricketBallTextureLoader.load('images/ball3.png')
const cricketBallTexture4 = cricketBallTextureLoader.load('images/ball4.png') // Adjust the path to your texture

const cricketBallTextures = [
    cricketBallTexture1,
    cricketBallTexture2,
    cricketBallTexture3,
    cricketBallTexture4,
]

// Create 6 ball icons
const ballGeometry = new THREE.SphereGeometry(0.1, 32, 32)
const ballMaterials = cricketBallTextures.map(
    (texture) => new THREE.MeshBasicMaterial({ map: texture })
)

const balls: THREE.Object3D<THREE.Event>[] = [] // Array to store the ball objects
const ballBoundingBoxes: THREE.Box3[] = []

for (let i = 0; i < 6; i++) {
    const ball = new THREE.Mesh(ballGeometry, ballMaterials[i % ballMaterials.length])
    ball.position.set(-0.7657464742660522 + 0.3 * i, 0.66717102974653244, -3.1538567543029785)
    ball.frustumCulled = false
    scene.add(ball)

    const ballBoundingBox = new THREE.Box3()
    ballBoundingBox.setFromObject(ball)
    ballBoundingBox.expandByScalar(0.05) // Expand the bounding box a bit for accuracy

    ballBoundingBoxes.push(ballBoundingBox)

    ball.userData.index = i // Store the index for later reference
    ball.addEventListener('click', () => {
        console.log('started click')
        throwCricketBall(ball)
    })
    balls.push(ball)
}

console.log(balls)

// creating bounding boxes to check for collison

// Create bounding boxes for the GLB model and balls

const gltfLoader = new GLTFLoader(manager)
const gloveModel = gltfLoader.load(
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
                // Create a Cannon.js shape from the glove geometry
                const gloveShape = CannonUtils.CreateTrimesh((child as THREE.Mesh).geometry)

                const gloveBody = new CANNON.Body({ mass: 0 })
                gloveBody.addShape(gloveShape)

                gloveBody.position.set(
                    gltf.scene.position.x,
                    gltf.scene.position.y,
                    gltf.scene.position.z
                )
                gloveBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)

                // Add the glove body to the Cannon.js world
                world.addBody(gloveBody)

                let m = child as THREE.Mesh
                //m.castShadow = true
                m.frustumCulled = false
            }
        })

        const gloveBoundingBox = new THREE.Box3()
        //-----------CODE FOR DEBUGGING HELP ------------
        //@ts-ignore
        // const gloveBoundingBoxHelper = new THREE.Box3Helper(gloveBoundingBox, 0xffff00)
        // gloveBoundingBoxHelper.position.set(
        //     gltf.scene.position.x,
        //     gltf.scene.position.y,
        //     gltf.scene.position.z
        // )
        // faceTrackerGroup.add(gloveBoundingBoxHelper)

        // // Create a wireframe material for the bounding box
        // const gloveBoundingBoxMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 })

        // // Create a wireframe box geometry for the bounding box
        // const gloveBoundingBoxGeometry = new THREE.BoxGeometry()
        // gloveBoundingBox.applyMatrix4(gltf.scene.matrixWorld) // Apply the world matrix to the bounding box

        // // Create a mesh with the wireframe material and geometry
        // const gloveBoundingBoxMesh = new THREE.LineSegments(
        //     gloveBoundingBoxGeometry,
        //     gloveBoundingBoxMaterial
        // )

        // // Add the gloveBoundingBoxMesh as a child of the GLTF model
        // gltf.scene.add(gloveBoundingBoxMesh)

        // // Adjust the position and scale of the bounding box mesh if needed
        // gloveBoundingBoxMesh.position.set(0, 0, 0) // Set the position
        // gloveBoundingBoxMesh.scale.set(1, 1, 1) // Set the scale

        // // Make the bounding box visible
        // gloveBoundingBoxMesh.visible = true

        // Update bounding boxes in the animation loop
        updateBoundingBoxes = function () {
            // Update glove bounding box
            gloveBoundingBox.setFromObject(gltf.scene)

            // Update ball bounding boxes
            ballBoundingBoxes.forEach((boundingBox, index) => {
                boundingBox.setFromObject(balls[index])
            })
        }

        // Create an HTML element to display the score
        const scoreElement = document.createElement('div')
        scoreElement.innerText = 'Score: 0'
        scoreElement.style.position = 'absolute'
        scoreElement.style.color = 'white'
        scoreElement.style.top = '10px'
        scoreElement.style.left = '10px'
        document.body.appendChild(scoreElement)
        // Define a variable to keep track of the score

        // Collision detection
        checkCollisions = function () {
            // Check for collisions between glove and balls
            ballBoundingBoxes.forEach((ballBoundingBox, index) => {
                if (gloveBoundingBox.intersectsBox(ballBoundingBox)) {
                    let score = 0
                    // Collision detected between glove and the ball at index
                    // Implement collision response, e.g., bounce the ball
                    // Update the score
                    score++
                    scoreElement.innerText = 'Score: ' + score
                    console.log('collision detected', index)
                }
            })
        }

        // Function to animate the cricket ball
        throwCricketBall = function (
            ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
        ) {
            console.log('ball is thrown')
            const initialPosition = {
                x: ball.position.x,
                y: ball.position.y,
                z: ball.position.z,
            } // Initial position
            const screenHeight = window.innerHeight

            const randomX = Math.random() * 0.5 - 0.25 // Random variation in x-axis

            const randomZ = Math.random() * 0.5 - 0.25 // Random variation in z-axis

            const maxY = -screenHeight / 2 + ball.geometry.parameters.radius
            const targetPosition = {
                x: ball.position.x + randomX,
                y: gltf.scene.position.y - 1,
                z: ball.position.z + randomZ,
            } // Target position
            const throwDuration = 2000 // Animation duration in milliseconds
            const bounceHeight = 1

            new TWEEN.Tween(initialPosition)
                .to(targetPosition, throwDuration)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                    ball.position.set(initialPosition.x, initialPosition.y, initialPosition.z)
                })
                .start()
                .onComplete((e) => {
                    // Animation complete, you can add further actions here
                    console.log('ball thrown', e)
                    const bounceAnimation = new TWEEN.Tween(ball.position)
                        .to({ x: e.x, y: bounceHeight, z: e.z }, throwDuration / 2)
                        .easing(TWEEN.Easing.Bounce.Out)
                        .onComplete(() => {
                            console.log('bounce')
                        })
                    bounceAnimation.start()
                })
        }
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

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// Add a click event listener to the renderer
renderer.domElement.addEventListener('click', onDocumentClick, false)

function onDocumentClick(event: MouseEvent) {
    // Calculate the mouse coordinates (0 to 1) in the canvas
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    // Update the raycaster with the mouse position
    raycaster.setFromCamera(mouse, camera)

    // Calculate intersections
    const intersects = raycaster.intersectObjects(balls)

    // Check if any balls were clicked
    if (intersects.length > 0) {
        const clickedBall: any = intersects[0].object
        if (throwCricketBall) throwCricketBall(clickedBall)
    }
}

const clock = new THREE.Clock()
let delta
const cannonDebugRenderer = new CannonDebugRenderer(scene, world)

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

    delta = Math.min(clock.getDelta(), 0.1)
    world.step(delta)
    cannonDebugRenderer.update()

    if (checkCollisions) checkCollisions() // Check for collisions
    if (updateBoundingBoxes) updateBoundingBoxes() // Update bounding boxes' positions
    camera.updateFrame(renderer)
    mask.updateFromFaceAnchorGroup(faceTrackerGroup)
    TWEEN.update()
    render()
}

function render() {
    renderer.render(scene, camera)
}
animate()
