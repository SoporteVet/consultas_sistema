// Firebase configuration with detailed error handling

// Replace this with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyA0MKbA6xU2OlaCRFGNV_Ac22KmWU3Y2PI",
  authDomain: "consulta-7ece8.firebaseapp.com",
  databaseURL: "https://consulta-7ece8-default-rtdb.firebaseio.com",
  projectId: "consulta-7ece8",
  storageBucket: "consulta-7ece8.firebasestorage.app",
  messagingSenderId: "960058925183",
  appId: "1:960058925183:web:9cec6000f0788d61b31f4a",
  measurementId: "G-6JVD4VRDBJ"
};

// Initialize Firebase with proper error handling
try {
  // Check if Firebase is already initialized
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  } else {
    console.log("Firebase already initialized");
  }

  // Initialize references
  const database = firebase.database();
  const ticketsRef = database.ref('tickets');
  const settingsRef = database.ref('settings');
  
  // Check connection status with better error handling - removing auto-redirect
  let connectionRef = database.ref('.info/connected');
  connectionRef.on('value', (snap) => {
    // Store connection status without taking automatic action
    const isConnected = snap.val() === true;
    window.firebaseConnected = isConnected;
    
    if (isConnected) {
      console.log("Connected to Firebase database successfully");
    } else {
      console.warn("Disconnected from Firebase database - check your network connection");
      
      // Show connection error without redirecting
      const existingError = document.getElementById('firebase-connection-error');
      if (!existingError) {
        const errorMessage = document.createElement('div');
        errorMessage.id = 'firebase-connection-error';
        errorMessage.style.position = 'fixed';
        errorMessage.style.bottom = '20px';
        errorMessage.style.right = '20px';
        errorMessage.style.background = '#ff9800';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '10px 15px';
        errorMessage.style.borderRadius = '5px';
        errorMessage.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        errorMessage.style.zIndex = '9999';
        errorMessage.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Conexión perdida. Reconectando...';
        
        document.body.appendChild(errorMessage);
        
        // Remove the error message when connected again
        connectionRef.on('value', function removeError(snapshot) {
          if (snapshot.val() === true) {
            if (errorMessage.parentNode) {
              errorMessage.parentNode.removeChild(errorMessage);
            }
            connectionRef.off('value', removeError);
          }
        });
      }
    }
  }, (error) => {
    console.error("Error monitoring database connection:", error.code);
    // Log but don't redirect
  });
  
  // Export the Firebase services for use throughout the application
  window.database = database;
  window.ticketsRef = ticketsRef;
  window.settingsRef = settingsRef;
  
} catch (error) {
  console.error("Error initializing Firebase:", error);
  
  // Show a visible error message to the user
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '20px';
  errorDiv.style.left = '50%';
  errorDiv.style.transform = 'translateX(-50%)';
  errorDiv.style.background = '#f44336';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '15px 20px';
  errorDiv.style.borderRadius = '5px';
  errorDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  errorDiv.style.zIndex = '9999';
  errorDiv.textContent = 'Error al conectar con Firebase. Verifique su configuración.';
  
  document.body.appendChild(errorDiv);
  
  // Remove error message after 7 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 7000);
}
