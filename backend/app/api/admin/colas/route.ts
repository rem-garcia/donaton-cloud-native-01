import { GestionColasService } from "@/src/service/gestionColasService";
import { NextResponse } from "next/server";

const gestionColasService = new GestionColasService();

export const GET = async () => {
    const metricas = await gestionColasService.metricas();

    return NextResponse.json(metricas, { status: 200 });
};