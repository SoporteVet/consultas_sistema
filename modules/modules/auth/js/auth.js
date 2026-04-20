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
    canExportData: true,
    canViewConsentForms: true,
    canViewVacunas: true,
    canEditVacunas: true,
    canEditTurnos: true,
    canAccessInternamientos: true
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
    canExportData: false,
    canViewConsentForms: true,
    canViewVacunas: false,
    canEditVacunas: false,
    canEditTurnos: false
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
    canExportData: false,
    canViewConsentForms: true,
    canViewVacunas: true,
    canEditVacunas: false,
    canEditTurnos: false,
    canAccessInternamientos: true
  },
  laboratorio: {
    canViewTickets: true,
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: false,
    canViewStats: false,
    canManageBackup: false,
    canViewFullTicket: true,
    canViewSchedule: false,
    canExportData: false,
    canViewConsentForms: true,
    canViewVacunas: false,
    canEditVacunas: false,
    canEditTurnos: false
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
    canExportData: false,
    canViewConsentForms: true,
    canViewVacunas: false,
    canEditVacunas: false,
    canEditTurnos: false
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
    canExportData: false,
    canViewConsentForms: true,
    canViewVacunas: false,
    canEditVacunas: false,
    canEditTurnos: false,
    canAccessInternamientos: true
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
    canExportData: false,
    canViewConsentForms: false,
    canViewVacunas: false,
    canEditVacunas: false,
    canEditTurnos: false
  }
};

// Check if user is logged in - fixed to prevent redirect loops completely
function checkAuth() {
  return new Promise((resolve, reject) => {
    // Check if we're already on the login page (home.html)
    const onLoginPage = window.location.pathname.toLowerCase().includes('home.html') || 
                       window.location.pathname.endsWith('/');
    
    // Check session storage first for quick UI response
    const userRole = sessionStorage.getItem('userRole');
    const userName = sessionStorage.getItem('userName');
    
    // If we have session data and we're not on the login page, trust it for immediate UI rendering
    if (userRole && userName && !onLoginPage) {
      
      // Return cached session data immediately
      resolve({
        role: userRole,
        name: userName,
        email: sessionStorage.getItem('userEmail'),
        empresa: sessionStorage.getItem('userEmpresa') || 'veterinaria_smp'
      });
      
      // Still verify with Firebase in background without redirecting
      try {
        firebase.auth().onAuthStateChanged((user) => {
          if (!user) {
            // Firebase session invalid but using sessionStorage data
            // Don't clear sessionStorage here to prevent UI flashing
          }
        });
      } catch (error) {
        // Error verifying authentication
      }
      return;
    }
    
    // If on login page, prevent checking auth to avoid redirects
    if (onLoginPage) {
      resolve(null); // Cambiado: resolver en vez de rechazar para evitar error
      return;
    }
    
    // If no session data, check Firebase auth without redirecting
    try {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
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
                
                // Store empresa in session - default to veterinaria_smp if not set
                const userEmpresa = userData.empresa || 'veterinaria_smp';
                sessionStorage.setItem('userEmpresa', userEmpresa);
                
                // If user doesn't have empresa, update in database
                if (!userData.empresa) {
                  firebase.database().ref(`users/${user.uid}/empresa`).set('veterinaria_smp');
                }
                
                resolve(userData);
              } else {
                // No role, assign default
                const defaultUserData = {
                  email: user.email,
                  role: 'recepcion',
                  name: user.email.split('@')[0],
                  empresa: 'veterinaria_smp'
                };
                
                firebase.database().ref(`users/${user.uid}`).set(defaultUserData)
                  .then(() => {
                    sessionStorage.setItem('userRole', defaultUserData.role);
                    sessionStorage.setItem('userName', defaultUserData.name);
                    sessionStorage.setItem('userEmail', user.email);
                    sessionStorage.setItem('userId', user.uid);
                    sessionStorage.setItem('userEmpresa', defaultUserData.empresa);
                    
                    resolve(defaultUserData);
                  })
                  .catch(error => {
                    reject(error);
                  });
              }
            })
            .catch(error => {
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
          
          if (!onLoginPage) {
            // Only manually redirect if not already on login page
            sessionStorage.clear();
            // Use a different approach than immediate redirect
            setTimeout(() => {
              window.location.href = 'home.html';
            }, 100);
          } else {
            // Already on login page, no redirect needed
          }
          
          reject(new Error('User not authenticated'));
        }
      });
    } catch (error) {
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

// Get current user's empresa
function getUserEmpresa() {
  return sessionStorage.getItem('userEmpresa') || 'veterinaria_smp';
}

// Get empresa display name
function getEmpresaDisplayName(empresaCode) {
  const empresaNames = {
    'veterinaria_smp': 'Veterinaria San Martín de Porres',
    'instituto_smp': 'Instituto Veterinario San Martín de Porres'
  };
  return empresaNames[empresaCode] || empresaCode;
}

// Set current empresa (for admin users)
function setCurrentEmpresa(empresaCode) {
  if (hasPermission('canViewStats')) { // Only admins can switch
    sessionStorage.setItem('currentEmpresa', empresaCode);
    // No recargar datos, solo re-renderizar con el nuevo filtro
    // Los datos ya están cargados, solo necesitamos filtrar por empresa
  }
}

// Get current empresa (for filtering - admins can override)
function getCurrentEmpresa() {
  const userRole = sessionStorage.getItem('userRole');
  // If admin, allow switching between empresas
  if (PERMISSIONS[userRole] && PERMISSIONS[userRole].canViewStats) {
    return sessionStorage.getItem('currentEmpresa') || getUserEmpresa();
  }
  // Non-admin users always see their assigned empresa
  return getUserEmpresa();
}

// Sign out
function signOut() {
  sessionStorage.clear();
  
  firebase.auth().signOut()
    .then(() => {
      window.location.href = 'home.html';
    })
    .catch((error) => {
      // Try to redirect anyway
      window.location.href = 'home.html';
    });
}

// Add to global scope
window.checkAuth = checkAuth;
window.hasPermission = hasPermission;
window.signOut = signOut;
window.getUserEmpresa = getUserEmpresa;
window.getEmpresaDisplayName = getEmpresaDisplayName;
window.setCurrentEmpresa = setCurrentEmpresa;
window.getCurrentEmpresa = getCurrentEmpresa;
