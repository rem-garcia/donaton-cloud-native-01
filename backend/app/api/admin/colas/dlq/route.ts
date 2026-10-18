import { GestionColasService } from "@/src/service/gestionColasService";
import { NextRequest, NextResponse } from "next/server";

const gestionColasService = new GestionColasService();

export const GET = async (request: NextRequest) => {
    const cola = request.nextUrl.searchParams.get("cola") ?? "";

    try {
        const mensajes = await gestionColasService.listarDlq(cola);

        return NextResponse.json(mensajes, { status: 200 });
    } catch (error) {
        const mensajeError = error instanceof Error ? error.message : "Error al listar la DLQ";

        return NextResponse.json({ error: mensajeError }, { status: 400 });
    }
};

export const DELETE = async (request: NextRequest) => {
    const cola = request.nextUrl.searchParams.get("cola") ?? "";

    try {
        const resultado = await gestionColasService.purgarDlq(cola);

        return NextResponse.json(resultado, { status: 200 });
    } catch (error) {
        const mensajeError = error instanceof Error ? error.message : "Error al purgar la DLQ";

        return NextResponse.json({ error: mensajeError }, { status: 400 });
    }
};