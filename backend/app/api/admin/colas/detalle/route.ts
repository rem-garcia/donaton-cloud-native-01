import { GestionColasService } from "@/src/service/gestionColasService";
import { NextRequest, NextResponse } from "next/server";

const gestionColasService = new GestionColasService();

export const GET = async (request: NextRequest) => {
    const cola = request.nextUrl.searchParams.get("cola") ?? "";

    try {
        const detalle = await gestionColasService.detalleCola(cola);

        return NextResponse.json(detalle, { status: 200 });
    } catch (error) {
        const mensajeError = error instanceof Error ? error.message : "Error al obtener el detalle";

        return NextResponse.json({ error: mensajeError }, { status: 400 });
    }
};