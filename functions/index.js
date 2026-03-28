const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { Resend } = require("resend");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// Copias internas del mismo reporte (mismo adjunto). Constantes: los parámetros de Firebase
// podían quedar vacíos en producción y anular el BCC; además Resend a veces no entrega bien CC/BCC.
// Enviar en `to` junto al cliente garantiza la entrega (el cliente verá estas direcciones en Para).
const LAB_INTERNAL_COPY_EMAILS = [
  "vetsanmartindeporres01@gmail.com",
];

// Cuerpos de correo según el tipo de caso
const EMAIL_MESSAGES = {
  consulta_externa: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjuntan los resultados de los exámenes realizados. El médico veterinario encargado cuenta con un plazo de 24 a 48 horas para brindarle el reporte correspondiente.

Si en ese plazo no ha sido contactado por el médico o los resultados aún no han sido reportados, y el paciente presenta una recaída o algún síntoma que comprometa su salud, le solicitamos traerlo a revaloración médica. De esta manera, se podrán interpretar los resultados y brindarle la receta médica correspondiente.

Después de las 8:00 p.m., puede comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.

Si el médico veterinario ya se comunicó con usted, por favor omita este mensaje.

Laboratorio Clínico Veterinario San Martín de Porres
Tel.: 4000-1365 Ext. 106
WhatsApp: 8839-2214`,

  internos: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjuntan los resultados de los exámenes realizados. El médico en turno en el Área de Internamiento le estará brindando el reporte de los mismos durante el siguiente reporte diario del paciente, a excepción que sea una emergencia.

Horario de reportes de internamiento: 9:00am a 2:00pm. Puede variar de acuerdo al estado de los pacientes. La salud de nuestros pacientes es la prioridad. Whatsapp de internamiento 8686-2140, no se aceptan llamadas vía Whatsapp.

Laboratorio Clínico Veterinario San Martin de Porres.
Tel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`,

  paquetes: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjunta el hemograma realizado en paquete de castración o de limpieza dental, el cual fue reportado antes del procedimiento.

En caso de que la mascota presente una recaída que comprometa su salud se recomienda traerla a revaloración de manera inmediata antes de las 7:30pm. Después de las 8:00pm comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.

Laboratorio Clínico Veterinario San Martin de Porres.
Tel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`,

  reportado: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjunta el Examen realizado, el cual fue reportado en consulta.

En caso de que la mascota presente una recaída que comprometa su salud se recomienda traerla a revaloración de manera inmediata antes de las 7:30pm. Después de las 8:00pm comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.

Laboratorio Clínico Veterinario San Martin de Porres.
Tel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`,

  sin_medico: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjunta el Examen realizado.

Laboratorio Clínico Veterinario San Martin de Porres.
Tel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`
};

/**
 * Primer apellido desde nombre completo (orden típico en español:
 * nombre(s) + apellido paterno + apellido materno).
 */
function primerApellidoDesdeNombre(nombreCompleto) {
  const partes = String(nombreCompleto || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length < 2) return "";
  if (partes.length === 2) return partes[1];
  // 3+ partes: penúltima suele ser el primer apellido cuando hay dos apellidos al final
  return partes[partes.length - 2];
}

function buildHtmlBody(text, clientName, petName) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; background: #f9f9f9; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background:rgb(97, 183, 249); color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
    .body { padding: 28px 32px; line-height: 1.7; font-size: 15px; }
    .footer { background: #f0f0f0; padding: 14px 32px; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Laboratorio Clínico Veterinario</h1>
      <p>San Martín de Porres</p>
    </div>
    <div class="body">
      <p>${escaped}</p>
    </div>
    <div class="footer">
      Este correo fue enviado automáticamente.
    </div>
  </div>
</body>
</html>`;
}

exports.sendLabReport = onRequest(
  { cors: true, secrets: [RESEND_API_KEY] },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const { to, pdfBase64, fileName, messageType, clientName, petName } = req.body;

    if (!to || !pdfBase64 || !fileName || !messageType) {
      return res.status(400).json({ error: "Faltan campos requeridos: to, pdfBase64, fileName, messageType" });
    }

    const bodyText = EMAIL_MESSAGES[messageType] || EMAIL_MESSAGES.sin_medico;
    const htmlBody = buildHtmlBody(bodyText, clientName, petName);

    const apellido = primerApellidoDesdeNombre(clientName);
    const nombreMascota = (petName && String(petName).trim()) || "Paciente";
    const subject = apellido
      ? `Reporte de Laboratorio - ${nombreMascota} ${apellido}`
      : `Reporte de Laboratorio - ${nombreMascota}`;

    // pdfBase64 puede llegar como data URL ("data:application/pdf;base64,...")
    // Resend espera solo la parte base64
    const base64Content = pdfBase64.includes(",")
      ? pdfBase64.split(",")[1]
      : pdfBase64;

    const resend = new Resend(RESEND_API_KEY.value());

    const clientNorm = String(to).trim().toLowerCase();
    const allRecipients = [
      String(to).trim(),
      ...LAB_INTERNAL_COPY_EMAILS.map((e) => e.trim()).filter(
        (e) => e.includes("@") && e.toLowerCase() !== clientNorm
      )
    ];
    const toList = [...new Set(allRecipients)];

    const { data, error } = await resend.emails.send({
      from: "Laboratorio Vet San Martin <laboratorio@vetsanmartin.com>",
      to: toList,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: fileName,
          content: base64Content
        }
      ]
    });

    if (error) {
      console.error("Error Resend:", error);
      return res.status(500).json({ error: error.message || "Error al enviar el correo" });
    }

    console.log("Email enviado correctamente. ID:", data.id);
    return res.status(200).json({ success: true, id: data.id });
  }
);
