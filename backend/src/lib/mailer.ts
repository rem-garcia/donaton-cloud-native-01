// Envio de correo via la API HTTP de Resend (https://resend.com/docs/api-reference/emails/send-email).
// Se usa fetch para no agregar dependencias. Variables de entorno:
//   RESEND_API_KEY  -> API key de Resend
//   MAIL_FROM       -> remitente verificado, ej: "Donaton <no-reply@tudominio.cl>"
// Si faltan y NO estamos en produccion, el correo solo se imprime en consola (desarrollo).

export interface Correo {
    para: string;
    asunto: string;
    html: string;
    texto: string;
}

export function escaparHtml(valor: string): string {
    return valor
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export async function enviarCorreo(correo: Correo): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;

    if (!apiKey || !from) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("Faltan RESEND_API_KEY o MAIL_FROM en las variables de entorno");
        }

        console.log(`[mailer:dev] Para: ${correo.para} | Asunto: ${correo.asunto}\n${correo.texto}`);
        return;
    }

    const respuesta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to: [correo.para],
            subject: correo.asunto,
            html: correo.html,
            text: correo.texto,
        }),
    });

    if (!respuesta.ok) {
        throw new Error(`Resend respondio ${respuesta.status}: ${await respuesta.text()}`);
    }
}