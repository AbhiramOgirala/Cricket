const { Camera, CameraView } = require('expo-camera');

console.log('Camera exists:', !!Camera);
if (Camera) {
  console.log('Camera.getCameraPermissionsAsync exists:', !!Camera.getCameraPermissionsAsync);
}
console.log('CameraView exists:', !!CameraView);
