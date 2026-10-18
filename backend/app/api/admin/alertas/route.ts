import { GestionColasService } from "@/src/service/gestionColasService";
import { NextRequest, NextResponse } from "next/server";

const gestionColasService = new GestionColasService();

export const GET = async () => {
    const alertas = await gestionColasService.listarAlertas();

    return NextResponse.json(alertas, { status: 200 });
};

export const DELETE = async (request: NextRequest) => {
    const msgId = Number(request.nextUrl.searchParams.get("id"));

    try {
        const resultado = await gestionColasService.confirmarAlerta(msgId);

        return NextResponse.json(resultado, { status: 200 });
    } catch (error) {
        const mensajeError = error instanceof Error ? error.message : "Error al confirmar la alerta";

        return NextResponse.json({ error: mensajeError }, { status: 400 });
    }
};