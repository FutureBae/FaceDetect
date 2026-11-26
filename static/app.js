const video = document.querySelector("#camera");
const statusMessage = document.querySelector("#status");
const startCameraButton = document.querySelector("#start-camera");
const scanFaceButton = document.querySelector("#scan-face");
const cameraSection = document.querySelector("#camera-section");
const registerForm = document.querySelector("#register-form");
const profilePanel = document.querySelector("#profile-panel");
const profileName = document.querySelector("#profile-name");
const profileEmail = document.querySelector("#profile-email");
const lockProfileButton = document.querySelector("#lock-profile");

let cameraStream;
let pendingDescriptor;

function setStatus(message, kind = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind;
}

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  video.srcObject = null;
  startCameraButton.textContent = "Turn on camera";
  startCameraButton.disabled = false;
  scanFaceButton.disabled = true;
}

async function loadModels() {
  const modelUrl = "https://justadudewhohacks.github.io/face-api.js/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
  ]);
  startCameraButton.disabled = false;
  setStatus("Models ready. Turn on your camera to get started.");
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = cameraStream;
    await video.play();
    scanFaceButton.disabled = false;
    startCameraButton.textContent = "Camera is on";
    startCameraButton.disabled = true;
    setStatus("Camera is ready. Center your face and select Recognise my face.");
  } catch (error) {
    setStatus(`Could not access the camera: ${error.message}`, "error");
  }
}

async function scanFace() {
  scanFaceButton.disabled = true;
  registerForm.hidden = true;
  setStatus("Looking for a face…");
  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setStatus("No face found. Move into the camera frame and try again.", "error");
      return;
    }

    pendingDescriptor = Array.from(detection.descriptor);
    const response = await fetch("/api/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptor: pendingDescriptor }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Face recognition failed.");
    }

    if (result.recognized) {
      showProfile(result.profile);
      setStatus("Face recognised.");
    } else {
      registerForm.hidden = false;
      document.querySelector("#name").focus();
      setStatus("We don’t recognise you yet. Add your details to create a profile.");
    }
  } catch (error) {
    setStatus(error.message || "Could not recognise this face.", "error");
  } finally {
    scanFaceButton.disabled = false;
  }
}

function showProfile(profile) {
  stopCamera();
  cameraSection.hidden = true;
  registerForm.hidden = true;
  profileName.textContent = profile.name;
  profileEmail.textContent = profile.email;
  profilePanel.hidden = false;
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = registerForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus("Saving your profile…");
  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.querySelector("#name").value,
        email: document.querySelector("#email").value,
        descriptor: pendingDescriptor,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not save your profile.");
    }
    showProfile(result.profile);
    setStatus("Profile created.");
  } catch (error) {
    setStatus(error.message || "Could not save your profile.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

lockProfileButton.addEventListener("click", () => {
  profilePanel.hidden = true;
  cameraSection.hidden = false;
  setStatus("Turn on your camera to scan again.");
});

startCameraButton.addEventListener("click", startCamera);
scanFaceButton.addEventListener("click", scanFace);

window.addEventListener("beforeunload", stopCamera);

loadModels().catch((error) => {
  setStatus(`Could not load face models. Check your internet connection and refresh. ${error.message}`, "error");
});
