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
  } else {
    // Firebase already initialized
  }

  // Initialize references
  const database = firebase.database();
  const ticketsRef = database.ref('tickets');
  const settingsRef = database.ref('settings');
  
  // Check connection status — single listener, no nesting
  let connectionRef = database.ref('.info/connected');
  let _connectionErrorEl = null;
  connectionRef.on('value', (snap) => {
    const isConnected = snap.val() === true;
    window.firebaseConnected = isConnected;
    
    if (isConnected) {
      // Remove error banner if it exists
      if (_connectionErrorEl && _connectionErrorEl.parentNode) {
        _connectionErrorEl.parentNode.removeChild(_connectionErrorEl);
        _connectionErrorEl = null;
      }
    } else {
      // Show error banner only once
      if (!_connectionErrorEl && !document.getElementById('firebase-connection-error')) {
        _connectionErrorEl = document.createElement('div');
        _connectionErrorEl.id = 'firebase-connection-error';
        _connectionErrorEl.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#ff9800;color:white;padding:10px 15px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;';
        _connectionErrorEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Conexión perdida. Reconectando...';
        document.body.appendChild(_connectionErrorEl);
      }
    }
  }, () => {
    // Error monitoring database connection — silent
  });
  
  // Export the Firebase services for use throughout the application
  window.database = database;
  window.ticketsRef = ticketsRef;
  window.settingsRef = settingsRef;
  
} catch (error) {
  // Error initializing Firebase
  
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
