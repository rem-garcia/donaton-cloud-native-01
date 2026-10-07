import { DonacionRepository } from "../repository/donacionRepository";
import { donacionSchema } from "../schemas/donacionSchema";

export class DonacionService {
    constructor(private readonly donacionRepository: DonacionRepository) {};

    async obtenerDonaciones() {
        return await this.donacionRepository.getDonaciones();
    };

    async obtenerDonacionPorId(id: number) {
        return await this.donacionRepository.getDonacionById(id);
    };

    async crearDonacion(payload: unknown) {
        const payloadParsed = donacionSchema.safeParse(payload);

        if(!payloadParsed.success) {
            throw payloadParsed.error.issues?.[0]?.message;
        };

        return await this.donacionRepository.createDonacionConRecibo(payloadParsed.data);
    }

    async eliminarDonacion(id: number) {
        const donacion = await this.donacionRepository.getDonacionById(id);

        if(!donacion) {
            const error = new Error(`La donacion con id '${id}' no existe.`);

            throw error;
        };

        await this.donacionRepository.deleteDonacionById(id);
    }
};
