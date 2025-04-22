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
    canViewSidebarSchedule: true,
    canExportData: true
  },
  recepcion: {
    canViewTickets: true,
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: false,
    canViewStats: false,
    canManageBackup: false,
    canViewFullTicket: false,
    canViewSchedule: true,  // enable calendar view
    canViewSidebarSchedule: false, // hide sidebar horario tab
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
    canViewSchedule: false,  // disable calendar for visitas
    canViewSidebarSchedule: false,
    canExportData: false
  }
};

// Check if user is logged in - fixed to prevent redirect loops completely
function checkAuth() {
  return new Promise((resolve, reject) => {
    console.log("Checking authentication status...");
    
    const onLoginPage = window.location.pathname.toLowerCase().includes('home.html');
    
    // Remove sessionStorage shortcut to force Firebase auth check
    
    // If on login page, skip auth
    if (onLoginPage) {
      console.log("On login page, skipping auth check");
      reject(new Error('On login page'));
      return;
    }
    
    // If no session data, check Firebase auth without redirecting
    try {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          if (user.isAnonymous) {
            console.log("Anonymous session detected - forcing login");
            firebase.auth().signOut();
            reject(new Error('User not authenticated'));
            return;
          }
          console.log("User authenticated:", user.email);
          
          // Get user role from database
          firebase.database().ref(`users/${user.uid}`).once('value')
            .then((snapshot) => {
              const userData = snapshot.val();
              if (userData && userData.role) {
                // Store role in session
                sessionStorage.setItem('userRole', userData.role);
                const derivedName = userData.name || (user.email ? user.email.split('@')[0] : '');
                sessionStorage.setItem('userName', derivedName);
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
                  name: user.email ? user.email.split('@')[0] : ''
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
                // Fallback to default role if no permission to read user records
                const fallbackData = { role: 'recepcion', name: user.email ? user.email.split('@')[0] : '' };
                sessionStorage.setItem('userRole', fallbackData.role);
                sessionStorage.setItem('userName', fallbackData.name);
                resolve(fallbackData);
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
