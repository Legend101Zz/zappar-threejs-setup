import * as THREE from 'three'
import * as ZapparThree from '@zappar/zappar-threejs'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

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
const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

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

const controls = new OrbitControls(camera, renderer.domElement)

const geometry = new THREE.BoxGeometry()
const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
})

const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

function animate() {
    requestAnimationFrame(animate)

    cube.rotation.x += 0.01
    cube.rotation.y += 0.01
    camera.updateFrame(renderer)
    controls.update()

    render()
}

function render() {
    renderer.render(scene, camera)
}
animate()
