import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TextureLoader } from 'three';

let scene, camera, renderer;
let snowman;
let snow; // Add snow particles
const snowCount = 1000; // Number of snowflakes
const snowRadius = 20; // Area where snow can fall
// Add new variables for ground
let ground;
const groundSize = 40;
const gridSize = 40;
let heightMap;
let time = 0; // For wave motion
let snowAccumulationSpeed = 0.01;
let snowFallSpeed = 0.02;
let controls;
const textureLoader = new TextureLoader();
let snowmanHead;

function init() {
    // Create scene
    scene = new THREE.Scene();
    
    // Adjust fog to be denser (color, near distance, far distance)
    scene.fog = new THREE.Fog(0x1a237e, 1, 20); // Changed far distance from 30 to 20
    scene.background = new THREE.Color(0x1a237e);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 3, 6);

    // Create renderer with adjusted clear color
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false
    });
    
    // Set size to match container's aspect ratio
    const container = document.querySelector('.scene-container');
    const size = Math.min(container.clientWidth, container.clientHeight);
    renderer.setSize(size, size);
    
    renderer.setClearColor(0x1a237e);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.physicallyCorrectLights = true;
    container.appendChild(renderer.domElement);

    // Add orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth camera movement
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 2; // Minimum zoom
    controls.maxDistance = 10; // Maximum zoom
    controls.maxPolarAngle = Math.PI / 1.5; // Limit vertical rotation
    controls.minPolarAngle = Math.PI / 6; // Limit vertical rotation

    // Create ground first
    createGround();

    // Create snowman
    createSnowman();

    // Setup lights (after both ground and snowman are created)
    setupLights();

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start animation
    animate();

    // Setup rotation animation
    setupRotationAnimation();

    // Create snow last
    createSnow();

    // Add event listeners for controls
    const snowSpeedControl = document.getElementById('snow-speed');
    const fallSpeedControl = document.getElementById('fall-speed');
    
    snowSpeedControl.addEventListener('input', (e) => {
        snowAccumulationSpeed = parseFloat(e.target.value) / 1000;
    });

    fallSpeedControl.addEventListener('input', (e) => {
        snowFallSpeed = parseFloat(e.target.value) / 1000;
    });

    // Add clear snow button listener
    const clearSnowButton = document.getElementById('clear-snow');
    clearSnowButton.addEventListener('click', clearAccumulatedSnow);
}

function createSnowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    // Fill with light gray base
    context.fillStyle = '#f0f0f0';
    context.fillRect(0, 0, 128, 128);

    // Create Perlin-like noise effect
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const value = Math.random();
            if (value > 0.5) {
                const intensity = 0.95 + Math.random() * 0.05;
                context.fillStyle = `rgb(${255 * intensity}, ${255 * intensity}, ${255 * intensity})`;
                context.fillRect(x, y, 1, 1);
            }
        }
    }

    // Add some larger snow clumps
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * 3;
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
    }

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createSnowMaterial() {
    const snowTexture = createSnowTexture();
    
    return new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 10,
        specular: 0x222222,
        bumpMap: snowTexture,
        bumpScale: 0.05,
        map: snowTexture,
        fog: true
    });
}

function createSnowman() {
    snowman = new THREE.Group();
    const snowMaterial = createSnowMaterial();

    // Bottom sphere (largest)
    const bottomGeometry = new THREE.SphereGeometry(1, 32, 32);
    const bottom = new THREE.Mesh(bottomGeometry, snowMaterial);
    bottom.position.y = -1;
    snowman.add(bottom);

    // Middle sphere
    const middleGeometry = new THREE.SphereGeometry(0.7, 32, 32);
    const middle = new THREE.Mesh(middleGeometry, snowMaterial);
    middle.position.y = 0.5;
    snowman.add(middle);

    // Create a group for the head and its features
    snowmanHead = new THREE.Group();
    snowmanHead.position.y = 1.5;

    // Head sphere (smallest)
    const headGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const head = new THREE.Mesh(headGeometry, snowMaterial);
    snowmanHead.add(head);

    // Eyes (update positions relative to head group)
    const eyeGeometry = new THREE.SphereGeometry(0.05, 32, 32);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 0.1, 0.35);
    snowmanHead.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 0.1, 0.35);
    snowmanHead.add(rightEye);

    // Carrot nose (update position relative to head group)
    const noseGeometry = new THREE.ConeGeometry(0.08, 0.3, 32);
    const noseMaterial = new THREE.MeshPhongMaterial({ color: 0xff6600 });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 0, 0.4);
    nose.rotation.x = Math.PI / 2;
    nose.position.z += 0.15;
    snowmanHead.add(nose);

    // Add head group to snowman
    snowman.add(snowmanHead);
    scene.add(snowman);
}

function setupRotationAnimation() {
    // Convert degrees to radians for initial position
    snowmanHead.rotation.y = THREE.MathUtils.degToRad(-45);

    // Create an infinite rotation timeline
    gsap.to(snowmanHead.rotation, {
        y: THREE.MathUtils.degToRad(45),
        duration: 4,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1
    });
}

function createSnow() {
    const snowGeometry = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3); // 3 values (x,y,z) per particle
    const snowSpeeds = new Float32Array(snowCount); // Speed for each snowflake

    for (let i = 0; i < snowCount * 3; i += 3) {
        // Random position within a cylinder shape
        const radius = Math.random() * snowRadius;
        const theta = Math.random() * Math.PI * 2;
        
        snowPositions[i] = radius * Math.cos(theta);     // x
        snowPositions[i + 1] = Math.random() * 20 - 10;  // y (height)
        snowPositions[i + 2] = radius * Math.sin(theta); // z
        
        // Initialize with base fall speed
        snowSpeeds[i/3] = snowFallSpeed + Math.random() * 0.001;
    }

    snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    
    // Create snow material
    const snowMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.2, // Increased size to better see the snowflake pattern
        transparent: true,
        opacity: 0.8,
        map: createSnowflakeTexture(),
        depthWrite: false,
        fog: true,
        blending: THREE.AdditiveBlending // Add this for better visibility
    });

    // Create the particle system
    snow = new THREE.Points(snowGeometry, snowMaterial);
    scene.add(snow);

    // Store speeds as a property of the snow object
    snow.userData.speeds = snowSpeeds;
}

function createSnowflakeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; // Increased size for more detail
    canvas.height = 32;
    
    const context = canvas.getContext('2d');
    context.fillStyle = 'black';
    context.fillRect(0, 0, 32, 32);
    context.strokeStyle = 'white';
    context.lineWidth = 1;
    
    // Center of the snowflake
    const centerX = 16;
    const centerY = 16;
    const size = 14; // Size of each arm

    // Draw six arms of the snowflake
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        context.save();
        context.translate(centerX, centerY);
        context.rotate(angle);
        
        // Main arm
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(size, 0);
        context.stroke();
        
        // Small branches on each arm
        const branches = 3; // Number of branches per side
        const branchLength = size / 3;
        
        for (let j = 1; j <= branches; j++) {
            const position = (size / (branches + 1)) * j;
            
            // Right branch
            context.beginPath();
            context.moveTo(position, 0);
            context.lineTo(position + branchLength * 0.7, branchLength * 0.7);
            context.stroke();
            
            // Left branch
            context.beginPath();
            context.moveTo(position, 0);
            context.lineTo(position + branchLength * 0.7, -branchLength * 0.7);
            context.stroke();
        }
        
        context.restore();
    }

    // Add center detail
    context.beginPath();
    context.arc(centerX, centerY, 2, 0, Math.PI * 2);
    context.fillStyle = 'white';
    context.fill();

    // Create soft edges
    const imageData = context.getImageData(0, 0, 32, 32);
    const data = imageData.data;
    
    // Apply radial falloff
    for (let x = 0; x < 32; x++) {
        for (let y = 0; y < 32; y++) {
            const index = (y * 32 + x) * 4;
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            const alpha = Math.max(0, 1 - distance / 16);
            data[index + 3] = data[index + 3] * alpha;
        }
    }
    
    context.putImageData(imageData, 0, 0);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createGround() {
    // Create height map array with initial snow
    heightMap = new Array(gridSize * gridSize).fill(0);

    // Add initial snow with a natural pattern
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const index = i * gridSize + j;
            // Create a natural-looking snow pattern
            const distanceFromCenter = Math.sqrt(
                Math.pow((i - gridSize/2) / gridSize, 2) + 
                Math.pow((j - gridSize/2) / gridSize, 2)
            );
            const noise = Math.random() * 0.1; // Random variation
            heightMap[index] = Math.max(0, -1.8 + noise - distanceFromCenter * 0.3);
        }
    }

    // Create ground geometry
    const geometry = new THREE.PlaneGeometry(groundSize, groundSize, gridSize - 1, gridSize - 1);
    geometry.rotateX(-Math.PI / 2);

    // Create enhanced snow material for ground
    const groundSnowMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 5,
        specular: 0x222222,
        bumpMap: createSnowTexture(),
        bumpScale: 0.08,
        map: createSnowTexture(),
        fog: true
    });

    ground = new THREE.Mesh(geometry, groundSnowMaterial);
    ground.position.y = -2;

    // Apply initial height map to geometry
    const vertices = ground.geometry.attributes.position.array;
    for (let i = 0; i < heightMap.length; i++) {
        vertices[i * 3 + 1] = heightMap[i];
    }
    ground.geometry.attributes.position.needsUpdate = true;

    scene.add(ground);
}

function updateGround(x, z) {
    // Convert world coordinates to grid coordinates
    const halfSize = groundSize / 2;
    const gridX = Math.floor(((x + halfSize) / groundSize) * (gridSize - 1));
    const gridZ = Math.floor(((z + halfSize) / groundSize) * (gridSize - 1));

    if (gridX >= 0 && gridX < gridSize && gridZ >= 0 && gridZ < gridSize) {
        const index = gridZ * gridSize + gridX;
        heightMap[index] += snowAccumulationSpeed; // Use variable instead of fixed value

        // Update neighboring points for smoother appearance
        const radius = 2;
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const nx = gridX + i;
                const nz = gridZ + j;
                if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
                    const dist = Math.sqrt(i * i + j * j);
                    const factor = Math.max(0, 1 - dist / radius);
                    const nIndex = nz * gridSize + nx;
                    heightMap[nIndex] += snowAccumulationSpeed * 0.5 * factor; // Half the main accumulation for neighbors
                }
            }
        }

        // Update ground geometry
        const vertices = ground.geometry.attributes.position.array;
        for (let i = 0; i < heightMap.length; i++) {
            vertices[i * 3 + 1] = heightMap[i];
        }
        ground.geometry.attributes.position.needsUpdate = true;
    }
}

function updateSnow() {
    if (!snow) return;

    time += 0.005;

    const positions = snow.geometry.attributes.position.array;
    const speeds = snow.userData.speeds;

    for (let i = 0; i < positions.length; i += 3) {
        // Update fall speed based on current control value
        speeds[i/3] = snowFallSpeed + Math.random() * 0.001;
        
        // Update y position with current speed
        positions[i + 1] -= speeds[i/3];

        // Add wave motion
        const originalX = positions[i];
        const waveAmplitude = 0.01; // How wide the wave is
        const waveFrequency = 1; // How many waves
        
        // Create unique wave patterns for each particle
        const particleOffset = i * 0.1;
        positions[i] = originalX + Math.sin(time + positions[i + 1] * waveFrequency + particleOffset) * waveAmplitude;

        // Check for collision with accumulated snow or ground
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];

        // Get height at current x,z position
        const heightAtPoint = getHeightAtPoint(x, z);

        if (y < heightAtPoint) {
            // Accumulate snow at impact point
            updateGround(x, z);
            
            // Reset snowflake to top with better distribution
            positions[i + 1] = 10;
            
            // Use square distribution instead of circular
            positions[i] = (Math.random() - 0.5) * snowRadius * 2;    // x between -radius and +radius
            positions[i + 2] = (Math.random() - 0.5) * snowRadius * 2; // z between -radius and +radius
            
            // Add slight drift to the particles
            const drift = (Math.random() - 0.5) * 0.1;
            positions[i] += drift;
            positions[i + 2] += drift;
        }
    }

    snow.geometry.attributes.position.needsUpdate = true;
}

function getHeightAtPoint(x, z) {
    // Convert world coordinates to grid coordinates
    const halfSize = groundSize / 2;
    const gridX = Math.floor(((x + halfSize) / groundSize) * (gridSize - 1));
    const gridZ = Math.floor(((z + halfSize) / groundSize) * (gridSize - 1));

    if (gridX >= 0 && gridX < gridSize && gridZ >= 0 && gridZ < gridSize) {
        const index = gridZ * gridSize + gridX;
        return heightMap[index] - 2; // Subtract ground position offset
    }
    return -2; // Default ground height
}

function animate() {
    requestAnimationFrame(animate);
    updateSnow();
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.querySelector('.scene-container');
    const size = Math.min(container.clientWidth, container.clientHeight);
    
    camera.aspect = 1; // Keep 1:1 aspect ratio
    camera.updateProjectionMatrix();
    
    renderer.setSize(size, size);
}

function setupLights() {
    // Further increase ambient light for even softer illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0); // Increased from 0.8 to 1.0

    scene.add(ambientLight);

    // Further reduce main directional light intensity
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.7); // Reduced from 0.7 to 0.4
    mainLight.position.set(8, 12, 8);
    mainLight.castShadow = true;
    scene.add(mainLight);

    // Further reduce fill light
    const fillLight = new THREE.DirectionalLight(0x8aa8ff, 0.2); // Reduced from 0.3 to 0.2
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // Further reduce rim light
    const rimLight = new THREE.DirectionalLight(0xffd5b8, 0.1); // Reduced from 0.2 to 0.1
    rimLight.position.set(0, 2, -5);
    scene.add(rimLight);

    // Enable shadow rendering with softer shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Configure shadow properties for much softer shadows
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -20;   // Further increased for wider shadow area
    mainLight.shadow.camera.right = 20;   
    mainLight.shadow.camera.top = 20;     
    mainLight.shadow.camera.bottom = -20; 
    
    // Increase shadow map size even more for smoother edges
    mainLight.shadow.mapSize.width = 512;   // Reduced for more blur
    mainLight.shadow.mapSize.height = 512;  
    
    // Increase blur settings significantly
    mainLight.shadow.radius = 15;           // Increased blur radius significantly
    mainLight.shadow.bias = -0.0005;        // Adjusted bias
    mainLight.shadow.normalBias = 0.04;     // Increased normal bias
    
    // Move light even further for softer shadows
    mainLight.position.set(12, 15, 12);     // Moved light further away

    // Enable shadow casting and receiving
    ground.receiveShadow = true;
    snowman.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
}

function clearAccumulatedSnow() {
    // Reset height map to initial pattern
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const index = i * gridSize + j;
            const distanceFromCenter = Math.sqrt(
                Math.pow((i - gridSize/2) / gridSize, 2) + 
                Math.pow((j - gridSize/2) / gridSize, 2)
            );
            const noise = Math.random() * 0.1;
            heightMap[index] = Math.max(0, -1.8 + noise - distanceFromCenter * 0.3);
        }
    }
    
    // Update ground geometry
    const vertices = ground.geometry.attributes.position.array;
    for (let i = 0; i < heightMap.length; i++) {
        vertices[i * 3 + 1] = heightMap[i];
    }
    ground.geometry.attributes.position.needsUpdate = true;
}

// Initialize the scene
init(); 