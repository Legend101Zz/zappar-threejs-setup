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

let updateBoundingBoxes: () => void
let checkCollisions: () => void
let throwCricketBall: (obj: any) => void
let modelReady = false

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const manager = new ZapparThree.LoadingManager()
// Use this function to set your context
let camera = new ZapparThree.Camera({
    userCameraSource: 'RKxXByjnabbADGQNNZqLVLdmXlS0YkETYCIbg+XxnvM=',
})
camera.userCameraMirrorMode = ZapparThree.CameraMirrorMode.CSS
ZapparThree.glContextSet(renderer.getContext())
const scene = new THREE.Scene()
scene.background = camera.backgroundTexture
// Create a camera and set the scene background to the camera's backgroundTexture

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
    // creating bounding boxes to check for collison
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

// const loadingText = document.createElement('div')
// loadingText.innerText = 'Move your head to catch the balls'
// loadingText.style.position = 'absolute'
// loadingText.style.color = 'white'
// loadingText.style.fontSize = '24px'
// loadingText.style.top = '10px'
// loadingText.style.left = '10px'
// document.body.appendChild(loadingText)

// // Add an arrow animation
// const arrow = document.createElement('div')
// arrow.style.width = '0'
// arrow.style.height = '0'
// arrow.style.borderLeft = '10px solid transparent'
// arrow.style.borderRight = '10px solid transparent'
// arrow.style.borderBottom = '20px solid white'
// arrow.style.position = 'absolute'
// arrow.style.top = '50px'
// arrow.style.left = '50%'
// arrow.style.transform = 'translateX(-50%)'
// document.body.appendChild(arrow)

// Create bounding boxes for the GLB model and balls

const gltfLoader = new GLTFLoader(manager)
const gloveModel = gltfLoader.load(
    'models/gloves.glb',
    (gltf) => {
        // setInterval(() => {
        //     document.body.removeChild(loadingText)
        //     document.body.removeChild(arrow)
        // }, 2000)

        gltf.scene.scale.set(2, 2, 2)
        gltf.scene.position.set(0, -0.7, 1)
        gltf.scene.rotation.set(Math.PI / 2, 0, 0)
        console.log('model_here', gltf.scene)
        gltf.scene.name = 'glove'

        // Add the scene to the tracker group
        gltf.scene.traverse(function (child) {
            if ((child as THREE.Mesh).isMesh) {
                let m = child as THREE.Mesh

                //m.castShadow = true
                m.frustumCulled = false
            }
        })
        const gloveBoundingBox = new THREE.Box3()

        updateBoundingBoxes = function () {
            // Update glove bounding box
            gloveBoundingBox.setFromObject(gltf.scene)

            // Update ball bounding boxes
            ballBoundingBoxes.forEach((boundingBox, index) => {
                boundingBox.setFromObject(balls[index])
            })
        }

        // HTML element to display the score
        const scoreElement = document.createElement('div')
        scoreElement.innerText = 'Score: 0'
        scoreElement.style.position = 'absolute'
        scoreElement.style.color = 'white'
        scoreElement.style.top = '10px'
        scoreElement.style.left = '10px'
        document.body.appendChild(scoreElement)
        // Define a variable to keep track of the score
        let score = 0
        let scoreDisplayTimeout = null

        function showScoreText() {
            const center = calculateCenterOfScreen()
            const scoreText = document.createElement('div')
            scoreText.innerText = 'Score: ' + score
            scoreText.style.position = 'absolute'
            scoreText.style.color = 'red'
            scoreText.style.fontSize = '48px'
            scoreText.style.top = center.y - 24 + 'px' // Adjust positioning as needed
            scoreText.style.left = center.x - 100 + 'px' // Adjust positioning as needed
            document.body.appendChild(scoreText)

            scoreDisplayTimeout = setTimeout(() => {
                document.body.removeChild(scoreText)
            }, 2000) // Remove the score text after 2 seconds
        }

        // Collision detection
        checkCollisions = function () {
            console.log('checking for collisions')
            // Check for collisions between glove and balls
            ballBoundingBoxes.forEach((ballBoundingBox, index) => {
                if (gloveBoundingBox.intersectsBox(ballBoundingBox)) {
                    score++
                    scoreElement.innerText = 'Score: ' + score
                    console.log('Collision detected with ball ' + index)

                    const ball = balls[index]
                    ball.visible = false
                    faceTrackerGroup.add(ball)
                    // Call the score
                    showScoreText()
                }
            })
        }

        throwCricketBall = function (
            ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
        ) {
            console.log('started random')

            // Change the ball's mass to 1 when it is thrown

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
                //@ts-ignore
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

        // Set an interval to throw balls periodically

        setInterval(() => {
            const randomBallIndex = Math.floor(Math.random() * balls.length) // Select a random ball to throw
            const randomBall = balls[randomBallIndex] as THREE.Mesh<
                THREE.SphereGeometry,
                THREE.MeshBasicMaterial
            >
            throwCricketBall(randomBall)
        }, 5000)

        faceTrackerGroup.add(gltf.scene)
        modelReady = true
    },
    undefined,
    () => {
        console.log('An error ocurred loading the GLTF model')
    }
)

//animation on catching the ball

// Function to calculate the center of the viewport
function calculateCenterOfScreen() {
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    return { x: centerX, y: centerY }
}

const firecrackerCanvas: any = document.getElementById('firecrackerCanvas')
const firecrackerContext = firecrackerCanvas.getContext('2d')

function playFirecrackerAnimation() {
    const center = calculateCenterOfScreen()

    // Position the firecracker canvas at the center
    firecrackerCanvas.style.position = 'absolute'
    firecrackerCanvas.style.top = center.y - firecrackerCanvas.height / 2 + 'px'
    firecrackerCanvas.style.left = center.x - firecrackerCanvas.width / 2 + 'px'

    // Your custom animation code using firecrackerContext
    // Example animation: draw a circle at the center
    firecrackerContext.clearRect(0, 0, firecrackerCanvas.width, firecrackerCanvas.height)
    firecrackerContext.beginPath()
    firecrackerContext.arc(
        firecrackerCanvas.width / 2,
        firecrackerCanvas.height / 2,
        50,
        0,
        2 * Math.PI
    )
    firecrackerContext.fillStyle = 'red'
    firecrackerContext.fill()
}
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
    if (modelReady) {
        checkCollisions() // Check for collisions
        updateBoundingBoxes() // Update bounding boxes' positions
    }
    //cannonDebugRenderer.update()
    camera.updateFrame(renderer)
    mask.updateFromFaceAnchorGroup(faceTrackerGroup)
    TWEEN.update()
    render()
}

function render() {
    renderer.render(scene, camera)
}
animate()
