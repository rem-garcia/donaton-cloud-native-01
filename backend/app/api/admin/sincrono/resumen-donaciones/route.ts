import { SolicitudSincronaService } from "@/src/service/solicitudSincronaService";
import { NextResponse } from "next/server";

const solicitudSincronaService = new SolicitudSincronaService();

export const GET = async () => {
    try {
        const resultado = await solicitudSincronaService.solicitarResumen();

        return NextResponse.json(resultado, { status: 200 });
    } catch (error) {
        const mensajeError = error instanceof Error ? error.message : "Error en la solicitud sincrona";
        const status = mensajeError === "Tiempo de espera agotado" ? 504 : 500;

        return NextResponse.json({ error: mensajeError }, { status });
    }
};