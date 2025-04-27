// Mostrar el botón solo para admin
function showAdminUsersBtnIfAdmin() {
  if (sessionStorage.getItem('userRole') === 'admin') {
    document.getElementById('adminUsersBtn').style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  showAdminUsersBtnIfAdmin();

  const adminBtn = document.getElementById('adminUsersBtn');
  const modal = document.getElementById('adminUsersModal');
  const closeBtn = document.getElementById('closeAdminUsersModal');
  const createUserForm = document.getElementById('createUserForm');

  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Crear usuario
  if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('newUserEmail').value.trim();
      const name = document.getElementById('newUserName').value.trim();
      const role = document.getElementById('newUserRole').value;
      if (!email || !name || !role) return alert('Completa todos los campos');
      try {
        // Crear usuario con contraseña temporal
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1';
        const userCred = await firebase.auth().createUserWithEmailAndPassword(email, tempPassword);
        // Guardar datos en la base de datos
        await firebase.database().ref('users/' + userCred.user.uid).set({
          email, name, role
        });
        alert('Usuario creado. La contraseña temporal es: ' + tempPassword);
        createUserForm.reset();
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          alert('El correo ya está registrado.');
        } else {
          alert('Error: ' + err.message);
        }
      }
    });
  }
});