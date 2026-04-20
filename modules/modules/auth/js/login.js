// User authentication logic
document.addEventListener('DOMContentLoaded', function() {
  // Flag to prevent multiple redirects
  let isRedirecting = false;

  // Create test users for development (remove in production)
  createTestUsers();
  
  // Add loading timeout detection
  let loginTimeout = null;
  
  // Check if user is already logged in - prevent loops
  const currentPath = window.location.pathname;
  if (currentPath.toLowerCase().includes('home.html') || currentPath.endsWith('/')) {
    // Check Firebase initialization first
    if (!firebase.apps.length) {
      showError("Error de inicialización. Por favor, recarga la página.");
      return;
    }
    
    // Set a timeout to prevent hanging
    const redirectTimeout = setTimeout(() => {
      if (!isRedirecting) {
        // Clear any loading state if it exists
        resetLoginButton();
      }
    }, 10000);
    
    // Add marker to prevent multiple checks
    if (window.checkingAuth) {
      clearTimeout(redirectTimeout);
      return;
    }
    
    window.checkingAuth = true;
    
    firebase.auth().onAuthStateChanged(function(user) {
      clearTimeout(redirectTimeout); // Clear timeout on response
      window.checkingAuth = false;
      
      if (user && !isRedirecting) {
        isRedirecting = true;
        
        // Check if we already redirected recently - prevent loops
        const lastRedirect = sessionStorage.getItem('lastRedirect');
        const now = Date.now();
        if (lastRedirect && (now - parseInt(lastRedirect)) < 5000) {
          isRedirecting = false;
          return;
        }
        
        // Set redirect timestamp
        sessionStorage.setItem('lastRedirect', now.toString());
        
        // Check if user has a role in database before redirecting
        firebase.database().ref(`users/${user.uid}`).once('value')
          .then((snapshot) => {
            const userData = snapshot.val();
            if (userData && userData.role) {
              sessionStorage.setItem('userRole', userData.role);
              sessionStorage.setItem('userName', userData.name || user.email.split('@')[0]);
              redirectToApp();
            } else {
              // User exists but has no role, assign default
              firebase.database().ref(`users/${user.uid}`).set({
                email: user.email,
                role: 'recepcion', // Default role
                name: user.email.split('@')[0]
              }).then(() => {
                sessionStorage.setItem('userRole', 'recepcion');
                sessionStorage.setItem('userName', user.email.split('@')[0]);
                redirectToApp();
              }).catch(error => {
                // Don't redirect if there was an error
                isRedirecting = false;
                resetLoginButton();
              });
            }
          })
          .catch((error) => {
            // Don't redirect if there was an error
            isRedirecting = false;
            resetLoginButton();
          });
      } else {
        // No user logged in or already redirecting
      }
    });
  } else {
    // Not on login page, skipping auto-login check
  }

  // Login form submission
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      // Prevent the default form submission which would cause a page reload
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorMessage = document.getElementById('error-message');
      const loginButton = document.querySelector('.btn-login');
      
      // Validate input
      if (!email || !password) {
        showError("Por favor ingrese correo y contraseña");
        return;
      }
      
      // Add loading state to button
      loginButton.classList.add('loading');
      loginButton.disabled = true;
      loginButton.innerHTML = 'Iniciando sesión...';
      
      // Set login timeout - in case Firebase hangs
      if (loginTimeout) clearTimeout(loginTimeout);
      loginTimeout = setTimeout(() => {
        resetLoginButton();
        showError("La conexión ha tardado demasiado. Por favor, intente de nuevo.");
      }, 15000);
      
      // Clear previous error messages
      errorMessage.textContent = '';
      
      // Check Firebase initialization first
      if (!firebase.apps.length) {
        clearTimeout(loginTimeout);
        resetLoginButton();
        showError("Error de inicialización. Por favor, recarga la página.");
        return;
      }
      
      // USAR PERSISTENCIA NONE PARA SESIÓN POR PESTAÑA
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE)
        .then(() => {
          // Sign in with Firebase Auth SOLO en esta pestaña
          return firebase.auth().signInWithEmailAndPassword(email, password);
        })
        .then((userCredential) => {
          clearTimeout(loginTimeout); // Clear timeout
          
          if (isRedirecting) return; // Prevent duplicate processing
          isRedirecting = true;
          
          // Get user role from database
          const user = userCredential.user;
          
          firebase.database().ref(`users/${user.uid}`).once('value')
            .then((snapshot) => {
              const userData = snapshot.val();
              
              if (userData && userData.role) {
                // Store user role in session storage
                sessionStorage.setItem('userRole', userData.role);
                sessionStorage.setItem('userName', userData.name || email.split('@')[0]);
                sessionStorage.setItem('userEmail', email);
                sessionStorage.setItem('userId', user.uid);
                
                // Redirect to main app
                redirectToApp();
              } else {
                // User exists but has no role, assign default
                firebase.database().ref(`users/${user.uid}`).set({
                  email: email,
                  role: 'recepcion', // Default role
                  name: email.split('@')[0]
                }).then(() => {
                  sessionStorage.setItem('userRole', 'recepcion');
                  sessionStorage.setItem('userName', email.split('@')[0]);
                  sessionStorage.setItem('userEmail', email);
                  sessionStorage.setItem('userId', user.uid);
                  redirectToApp();
                }).catch(error => {
                  isRedirecting = false;
                  resetLoginButton();
                  showError("Error al configurar usuario: " + error.message);
                });
              }
            })
            .catch((error) => {
              isRedirecting = false;
              resetLoginButton();
              showError("Error al obtener datos del usuario: " + error.message);
            });
        })
        .catch((error) => {
          clearTimeout(loginTimeout); // Clear timeout
          
          // Display user-friendly error message
          if (error.code === 'auth/user-not-found' || 
              error.code === 'auth/wrong-password' || 
              error.code === 'auth/invalid-login-credentials') {
            showError("Credenciales incorrectas. Verifique su correo y contraseña.");
          } else if (error.code === 'auth/too-many-requests') {
            showError("Demasiados intentos fallidos. Intente más tarde.");
          } else {
            showError("Error al iniciar sesión: " + error.message);
          }
          
          // Remove loading state
          resetLoginButton();
        });
    });
  }
  
  // Helper function to show error message
  function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
      errorMessage.textContent = message;
      // Make error more visible by scrolling to it
      errorMessage.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }
  
  // Helper function to reset login button
  function resetLoginButton() {
    const loginButton = document.querySelector('.btn-login');
    if (loginButton) {
      loginButton.classList.remove('loading');
      loginButton.disabled = false;
      loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar sesión';
    }
  }
});

// Function to create test users for development purposes
function createTestUsers() {
  const testUsers = [
    { email: 'admin@veterinaria.com', password: 'Adm!n#Vet_2025$Xy', role: 'admin', name: 'Administrador' },
    { email: 'recepcion@veterinaria.com', password: 'Rec3pC!on$2025@Lp', role: 'recepcion', name: 'Recepción' },
    { email: 'visitas@veterinaria.com', password: 'Visitas123', role: 'visitas', name: 'Visitas' },
    { email: 'consultaexterna@veterinaria.com', password: 'C0nsuLt@Ext!2025%Zz', role: 'consulta_externa', name: 'Consulta Externa' },
    { email: 'internos@veterinaria.com', password: '1nt3rn0s@2025!Uv', role: 'internos', name: 'Internos' },
    { email: 'quirofano@veterinaria.com', password: 'Qu!r0f@n0%2025*Rt', role: 'quirofano', name: 'Quirófano' },
    { email: 'laboratorio@veterinaria.com', password: 'Lab0r@t0r!o2025#Xx', role: 'laboratorio', name: 'Laboratorio' },
  ];

  // Only attempt this if Firebase is properly initialized
  if (!firebase || !firebase.apps || !firebase.apps.length) {
    return;
  }
  
  // Check if database is accessible before attempting to create users
  try {
    firebase.database().ref('.info/connected').once('value')
      .then(() => {
        createUsers();
      })
      .catch(error => {
        // Database connection failed, skipping test user creation
      });
  } catch (error) {
    return;
  }

  function createUsers() {
    testUsers.forEach(user => {
      // Check if user exists first
      firebase.auth().fetchSignInMethodsForEmail(user.email)
        .then((signInMethods) => {
          if (signInMethods.length === 0) {
            // User doesn't exist, create them
            
            firebase.auth().createUserWithEmailAndPassword(user.email, user.password)
              .then((userCredential) => {
                // Store user role in database
                return firebase.database().ref(`users/${userCredential.user.uid}`).set({
                  email: user.email,
                  role: user.role,
                  name: user.name
                });
              })
              .then(() => {
                // Test user created successfully
              })
              .catch((error) => {
                // Handle specific error cases
                if (error.code === 'auth/email-already-in-use') {
                  // Test user already exists - no action needed
                  
                  // Try to ensure the user has correct role in database anyway
                  firebase.auth().signInWithEmailAndPassword(user.email, user.password)
                    .then((userCred) => {
                      firebase.database().ref(`users/${userCred.user.uid}`).update({
                        role: user.role,
                        name: user.name
                      })
                      .then(() => {
                        firebase.auth().signOut(); // Sign out after updating
                      });
                    })
                    .catch(err => {
                      // Could not update existing user
                    });
                } else if (error.code === 'auth/invalid-email') {
                  // Invalid email format for test user
                } else if (error.code === 'auth/weak-password') {
                  // Password too weak for test user
                } else {
                  // Error creating test user
                }
              });
          } else {
            // Test user already exists
          }
        })
        .catch((error) => {
          if (error.code === 'auth/invalid-api-key') {
            // Invalid Firebase API key. Check your firebase-config.js file.
          } else if (error.code === 'auth/network-request-failed') {
            // Network error when checking user. Check your internet connection.
          } else {
            // Error checking user
          }
        });
    });
  }
}

// Function to redirect to main app with loop prevention
function redirectToApp() {
  try {
    // Check if we're already on index page to prevent loops
    if (window.location.pathname.includes('index.html')) {
      return;
    }
    
    // Use a timeout to ensure session storage is fully set
    setTimeout(() => {
      // Adding a timestamp to prevent caching problems
      const timestamp = new Date().getTime();
      window.location.href = `index.html?t=${timestamp}`;
    }, 500);
  } catch (error) {
    alert("Hubo un problema al redirigir. Por favor intente de nuevo.");
    isRedirecting = false;
    
    // Reset login button if it exists
    const loginButton = document.querySelector('.btn-login');
    if (loginButton) {
      loginButton.classList.remove('loading');
      loginButton.disabled = false;
      loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar sesión';
    }
  }
}
