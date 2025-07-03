// ...todo el contenido del <script>...</script> que estaba en index.html...
document.addEventListener('DOMContentLoaded', function() {
    // 1. Inicializar fecha actual
    const today = new Date();
    const dateStr = today.getDate() + '/' + (today.getMonth() + 1) + '/' + today.getFullYear();
    document.getElementById('current-date').textContent = dateStr;
    
    // 2. Sistema para calcular el total
    const checkboxes = document.querySelectorAll('.test-checkbox');
    const totalPrice = document.getElementById('total-price');
    
    function updateTotal() {
        let total = 0;
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                total += parseInt(checkbox.dataset.precio);
            }
        });
        totalPrice.textContent = '₡' + total.toLocaleString();
    }
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateTotal);
    });
    
function updateTotal() {
    let total = 0;
    const selectedServicesList = document.getElementById('selected-services-list');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    
    // Clear the current list
    selectedServicesList.innerHTML = '';
    
    // Add selected services to the list and calculate total
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const precio = parseInt(checkbox.dataset.precio);
            total += precio;
            
            // Get the service name from the row
            const row = checkbox.closest('tr');
            const serviceNameElement = row.querySelector('td:first-child strong');
            const serviceName = serviceNameElement ? serviceNameElement.textContent : 'Servicio';
            
            // Create list item with service and price
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${serviceName}</span>
                <span>₡${precio.toLocaleString()}</span>
            `;
            selectedServicesList.appendChild(listItem);
        }
    });
    
    // Add items for services with "consultar" price
    document.querySelectorAll('.test-checkbox-consultar').forEach(checkbox => {
        if (checkbox.checked) {
            const row = checkbox.closest('tr');
            const serviceNameElement = row.querySelector('td:first-child strong');
            const serviceName = serviceNameElement ? serviceNameElement.textContent : 'Servicio';
            
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${serviceName}</span>
                <span>Consultar precio</span>
            `;
            selectedServicesList.appendChild(listItem);
        }
    });
    
    // Update both total displays
    totalPrice.textContent = '₡' + total.toLocaleString();
    summaryTotalPrice.textContent = '₡' + total.toLocaleString();
    
    // Show/hide the summary section based on whether there are selected services
    const summarySection = document.querySelector('.selected-services-summary');
    if (selectedServicesList.children.length > 0) {
        summarySection.style.display = 'block';
    } else {
        summarySection.style.display = 'none';
    }
}
    
    // 8. Filtrado de servicios por categoría
    const categorySelector = document.getElementById('service-category');
    if (categorySelector) {
        categorySelector.addEventListener('change', function() {
            const selectedCategory = this.value;
            const rows = document.querySelectorAll('#services-table tbody tr');
            
            rows.forEach(row => {
                if (selectedCategory === 'todos' || row.dataset.categoria === selectedCategory) {
                    row.classList.remove('hidden-row');
                } else {
                    row.classList.add('hidden-row');
                }
            });
            
            updateTotal();
        });
    }
});
const btnPdf = document.getElementById('btn-pdf');
if (btnPdf) {
    btnPdf.addEventListener('click', function() {
        const form = document.getElementById('lab-form');
        if (form.checkValidity()) {
            generarPDF();
        } else {
            form.reportValidity();
        }
    });
}

// Función para generar el PDF con formato adecuado
async function generarPDF() {
    try {
        // Mostrar indicador de carga
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';
        document.body.appendChild(loadingIndicator);
        
        // Obtener datos para el nombre del archivo
        const nombrePaciente = document.querySelector('input[name="nombre-paciente"]').value || 'paciente';
        const nombrePropietarioCompleto = document.querySelector('input[name="propietario"]').value || 'cliente';
        const apellidoCliente = nombrePropietarioCompleto.split(' ').pop() || 'cliente';
        
        // Crear una copia del contenedor para manipularlo sin afectar el original
        const elementoOriginal = document.querySelector('.container');
        const elementoParaImprimir = elementoOriginal.cloneNode(true);
        
        // Ocultar botones y secciones no necesarias para el PDF
        const elementosAOcultar = elementoParaImprimir.querySelectorAll('.form-buttons, .historic-section .test-info .test-heading');
        elementosAOcultar.forEach(el => {
            if (el) el.style.display = 'none';
        });
        
        const testHeading = elementoParaImprimir.querySelector('#test-heading');
        if (testHeading) testHeading.style.display = 'none';
        
        // Ocultar la tabla de servicios completa y mostrar solo el resumen
        const tablaServicios = elementoParaImprimir.querySelector('.table-container');
        if (tablaServicios) tablaServicios.style.display = 'none';
        
        // Ocultar el selector de categoría
        const categoryFilter = elementoParaImprimir.querySelector('.category-filter');
        if (categoryFilter) categoryFilter.style.display = 'none';
        
        const serviciosSummary = elementoParaImprimir.querySelector('.selected-services-summary');
        if (serviciosSummary) {
            serviciosSummary.style.display = 'block';
        }
    

// También ocultar la fila del total si no hay elementos seleccionados
const filasVisibles = elementoParaImprimir.querySelectorAll('#services-table tbody tr[style="display: ;"]');
if (filasVisibles.length === 0) {
    const filaTotal = elementoParaImprimir.querySelector('#services-table tfoot tr');
    if (filaTotal) filaTotal.style.display = 'none';
}
        // Crear un contenedor temporal para el PDF
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.appendChild(elementoParaImprimir);
        document.body.appendChild(tempContainer);
        
        // Esperar a que todas las imágenes se carguen
        const images = tempContainer.getElementsByTagName('img');
        const loadImages = Array.from(images).map(img => {
            return new Promise((resolve, reject) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = reject;
                }
            });
        });
        
        await Promise.all(loadImages);
        
        // Generar el canvas con html2canvas
        const canvas = await html2canvas(elementoParaImprimir, {
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: true
        });
        
        // Crear el PDF con jsPDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // Calcular dimensiones para ajustar el contenido a la página
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const imgWidth = 210 - 20; // Ancho de A4 menos margen
        const pageHeight = 320;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Posicionar la imagen centrada con márgenes
        const x = 10; // margen izquierdo
        const y = 10; // margen superior
        
        // Añadir la imagen al PDF
        pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
        
        // Generar el nombre del archivo
        const fileName = `hoja de laboratorio ${nombrePaciente} ${apellidoCliente}.pdf`;
        
        // Guardar el PDF
        pdf.save(fileName);
        
        // Limpiar
        document.body.removeChild(tempContainer);
        document.body.removeChild(loadingIndicator);
        
        console.log("PDF generado correctamente");
    } catch (error) {
        console.error("Error al generar PDF:", error);
        alert("Ocurrió un error al generar el PDF: " + error.message);
        
        // Limpiar el indicador de carga si hubo error
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            document.body.removeChild(loadingIndicator);
        }
    }
}

// --- RAZAS POR ESPECIE ---
const razasCaninas = [
    "Ainu", "Airedale terrier", "Akita", "Akita Inu", "Alaskan Malamute",
    "American Black and Tan Coonhound", "American Bull Terrier", "American Pit Bull Terrier",
    "American Staffordshire terrier", "American Water Spaniel", "Apso Tibetano", "Barzoi", 
    "Basenji", "Basset Hound", "Beagle", "Bichon Frise", "Bloodhound", "Bobtail", 
    "Border Collie", "Boston Terrier", "Bouvier des Flandres", "Boxer", "Bull terrier", 
    "Bull Terrier Miniatura", "Bulldog Americano", "Bulldog Francés", "Bulldog Inglés", 
    "Bullmastiff", "Cavalier King Charles Spaniel", "Chihuahua", "Chow Chow", 
    "Cocker Spaniel Americano", "Cocker Spaniel Inglés", "Collie", "Collie Escocés", 
    "Dachshund", "Dálmata", "Doberman", "Doberman Pincher", "Dogo Alemán", 
    "Dogo Argentino", "Dogo de Burdeos", "French Poodle", "Galgo Español", 
    "Galgo Inglés-español", "Golden Retriever", "Gran Danés", "Greyhound", 
    "Husky Siberiano", "Jack Russell Terrier", "Labrador Retriever", "Maltés", 
    "Pastor Alemán", "Pequinés", "Pomerania", "Pug", "Rottweiler", "Samoyedo", 
    "San Bernardo", "Schnauzer", "Shih Tzu", "SRD", "Yorkshire Terrier", "Weimaraner", "Fila Brasileiro",
];

const razasFelinas = [
    "Abisinio", "American Bobtail", "Angora Turco", "Azul Ruso", "Balinés", 
    "Bengalí", "Bobtail japonés", "Bombay", "British Shorthair", "Burmés", 
    "Carey", "Común Europeo", "Exótico", "Himalayo", "Javanés", 
    "Oriental", "Persa", "Sagrado de Birmania", "Siamés", "Siberiano", 
    "Silvestre", "SRD"
];

function actualizarRazasPorEspecie() {
    const especie = document.getElementById('especieSelector').value;
    let datalistRazas = document.getElementById('razas');
    if (!datalistRazas) {
        datalistRazas = document.createElement('datalist');
        datalistRazas.id = 'razas';
        document.body.appendChild(datalistRazas);
    } else {
        datalistRazas.innerHTML = '';
    }
    const campoRaza = document.getElementById('mascotaRaza');
    if (campoRaza.value && campoRaza.value !== "SRD") {
        campoRaza.value = '';
    }
    if (especie === "Canino") {
        razasCaninas.forEach(raza => {
            const option = document.createElement('option');
            option.value = raza;
            datalistRazas.appendChild(option);
        });
    } else if (especie === "Felino") {
        razasFelinas.forEach(raza => {
            const option = document.createElement('option');
            option.value = raza;
            datalistRazas.appendChild(option);
        });
    } else if (especie === "Lagomorfo" || especie === "Cuilo") {
        const option = document.createElement('option');
        option.value = "SRD";
        datalistRazas.appendChild(option);
    }
}

// Inicializar razas al cargar y al cambiar especie
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    actualizarRazasPorEspecie();
    document.getElementById('especieSelector').addEventListener('change', actualizarRazasPorEspecie);
    // ...existing code...
});