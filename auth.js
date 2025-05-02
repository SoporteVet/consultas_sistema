// Authentication and permission management

// User roles and their permissions
const PERMISSIONS = {
  admin: {
    canViewTickets: true,
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: true,
    canViewStats: true,
    canManageBackup: true,
    canViewFullTicket: true,
    canViewSchedule: true,
    canExportData: true
  },
  recepcion: {
    canViewTickets: true,
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: false,
    canViewStats: false,
    canManageBackup: false,
    canViewFullTicket: true,
    canViewSchedule: false,  
    canExportData: false
  },
  consulta_externa: {
    canViewTickets: true,
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: false,
    canViewStats: false,
    canManageBackup: false,
    canViewFullTicket: true,
    canViewSchedule: false,
    canExportData: false
  },
  quirofano: {
    canViewTickets: true,
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: false,
    canViewStats: false,
    canManageBackup: false,
    canViewFullTicket: true,
    canViewSchedule: false,
    canExportData: false
  },
  internos: {
    canViewTickets: true,
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: false,
    canViewStats: false,
    canManageBackup: false,
    canViewFullTicket: true,
    canViewSchedule: false,
    canExportData: false
  },
  visitas: {
    canViewTickets: true,
    canCreateTickets: false,
    canEditTickets: false,
    canDeleteTickets: false,
    canViewStats: false,
    canManageBackup: false,
    canViewFullTicket: false,
    canViewSchedule: false,
    canExportData: false
  }
};

// Check if user is logged in - fixed to prevent redirect loops completely
function checkAuth() {
  return new Promise((resolve, reject) => {
    console.log("Checking authentication status...");
    
    // Check if we're already on the login page (home.html)
    const onLoginPage = window.location.pathname.toLowerCase().includes('home.html') || 
                       window.location.pathname.endsWith('/');
    
    // Check session storage first for quick UI response
    const userRole = sessionStorage.getItem('userRole');
    const userName = sessionStorage.getItem('userName');
    
    console.log("Session storage check - Role:", userRole, "Name:", userName);
    
    // If we have session data and we're not on the login page, trust it for immediate UI rendering
    if (userRole && userName && !onLoginPage) {
      console.log("Using session data for:", userName, "with role:", userRole);
      
      // Return cached session data immediately
      resolve({
        role: userRole,
        name: userName,
        email: sessionStorage.getItem('userEmail')
      });
      
      // Still verify with Firebase in background without redirecting
      try {
        firebase.auth().onAuthStateChanged((user) => {
          if (!user) {
            console.warn("Firebase session invalid but using sessionStorage data");
            // Don't clear sessionStorage here to prevent UI flashing
          }
        });
      } catch (error) {
        console.error("Error verifying authentication:", error);
      }
      return;
    }
    
    // If on login page, prevent checking auth to avoid redirects
    if (onLoginPage) {
      console.log("On login page, skipping auth check");
      resolve(null); // Cambiado: resolver en vez de rechazar para evitar error
      return;
    }
    
    // If no session data, check Firebase auth without redirecting
    try {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          console.log("User authenticated:", user.email);
          
          // Get user role from database
          firebase.database().ref(`users/${user.uid}`).once('value')
            .then((snapshot) => {
              const userData = snapshot.val();
              if (userData && userData.role) {
                // Store role in session
                sessionStorage.setItem('userRole', userData.role);
                sessionStorage.setItem('userName', userData.name || user.email.split('@')[0]);
                sessionStorage.setItem('userEmail', user.email);
                sessionStorage.setItem('userId', user.uid);
                
                console.log("User data loaded:", userData);
                resolve(userData);
              } else {
                console.log("User authenticated but no role found, creating default");
                // No role, assign default
                const defaultUserData = {
                  email: user.email,
                  role: 'recepcion',
                  name: user.email.split('@')[0]
                };
                
                firebase.database().ref(`users/${user.uid}`).set(defaultUserData)
                  .then(() => {
                    sessionStorage.setItem('userRole', defaultUserData.role);
                    sessionStorage.setItem('userName', defaultUserData.name);
                    sessionStorage.setItem('userEmail', user.email);
                    sessionStorage.setItem('userId', user.uid);
                    
                    console.log("Default user data saved:", defaultUserData);
                    resolve(defaultUserData);
                  })
                  .catch(error => {
                    console.error("Error saving default user data:", error);
                    reject(error);
                  });
              }
            })
            .catch(error => {
              console.error("Error fetching user data:", error);
              if (error.code === 'PERMISSION_DENIED') {
                // Sign out and redirect to login if no permission to read user record
                firebase.auth().signOut().finally(() => {
                  sessionStorage.clear();
                  window.location.href = 'home.html';
                });
                return;
              }
              reject(error);
            });
        } else {
          // Not authenticated - only redirect if not on login page
          console.log("User not authenticated");
          
          if (!onLoginPage) {
            console.log("Not on login page, should redirect");
            // Only manually redirect if not already on login page
            sessionStorage.clear();
            // Use a different approach than immediate redirect
            setTimeout(() => {
              window.location.href = 'home.html';
            }, 100);
          } else {
            console.log("Already on login page, no redirect needed");
          }
          
          reject(new Error('User not authenticated'));
        }
      });
    } catch (error) {
      console.error("Error checking authentication:", error);
      reject(error);
    }
  });
}

// Check if current user has a specific permission
function hasPermission(permission) {
  const userRole = sessionStorage.getItem('userRole') || 'visitas';
  const rolePermissions = PERMISSIONS[userRole] || PERMISSIONS.visitas;
  
  return rolePermissions[permission] === true;
}

// Sign out
function signOut() {
  console.log("Signing out user");
  sessionStorage.clear();
  
  firebase.auth().signOut()
    .then(() => {
      window.location.href = 'home.html';
    })
    .catch((error) => {
      console.error("Error signing out:", error);
      // Try to redirect anyway
      window.location.href = 'home.html';
    });
}

// Add to global scope
window.checkAuth = checkAuth;
window.hasPermission = hasPermission;
window.signOut = signOut;

console.log("Auth module loaded successfully");
