const { PrismaClient } = require("@prisma/client");
const { paginationUtils } = require("../utils/pagination");
const { toBoolean } = require("../utils/toBoolean");
const { getStartOfDay, getEndOfDay } = require("../utils/dateConverter");
const prisma = new PrismaClient();

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
const getAllTickets = async (req, res, next) => {
    try {

        const { bandara_keberangkatan, bandara_kedatangan, tanggal_pergi, tanggal_pulang, kelas, bagasi, hiburan, makanan, wifi, usb, min_harga, max_harga, no_transit, status_tiket } = req.query;

        const priceFilter = {};
        if (min_harga !== undefined) {
            priceFilter.gte = parseFloat(min_harga);
        }
        if (max_harga !== undefined) {
            priceFilter.lte = parseFloat(max_harga);
        }

        let transitStatus = undefined;

        if (toBoolean(no_transit)) {
            transitStatus = {
                Transit: {
                    none: {}
                }
            };
        }

        const startOfTanggalPergi = getStartOfDay(tanggal_pergi);
        const endOfTanggalPergi = getEndOfDay(tanggal_pergi);
        const startOfTanggalPulang = getStartOfDay(tanggal_pulang);
        const endOfTanggalPulang = getEndOfDay(tanggal_pulang);

        const ticketsTotal = await prisma.ticket.count({
            where: {
                kelas: kelas,
                bagasi: toBoolean(bagasi),
                hiburan: toBoolean(hiburan),
                makanan: toBoolean(makanan),
                wifi: toBoolean(wifi),
                usb: toBoolean(usb),
                ...(Object.keys(priceFilter).length > 0 && { harga: priceFilter }),
                schedule: {
                    flight: {
                        status: status_tiket,
                        bandara_keberangkatan: {
                            kode_bandara: bandara_keberangkatan
                        },
                        bandara_kedatangan: {
                            kode_bandara: bandara_kedatangan
                        },
                        ...transitStatus
                    },
                    ...(startOfTanggalPergi && endOfTanggalPergi && {
                        keberangkatan: {
                            gte: new Date(startOfTanggalPergi),
                            lt: new Date(endOfTanggalPergi)
                        }
                    }),
                    ...(startOfTanggalPulang && endOfTanggalPulang && {
                        kedatangan: {
                            gte: startOfTanggalPulang,
                            lt: endOfTanggalPulang
                        }
                    })
                }
            }
        });

        const pagination = paginationUtils(req.query.page, req.query.page_size, ticketsTotal);

        const tickets = await prisma.ticket.findMany({
            where: {
                kelas: kelas,
                bagasi: toBoolean(bagasi),
                hiburan: toBoolean(hiburan),
                makanan: toBoolean(makanan),
                wifi: toBoolean(wifi),
                usb: toBoolean(usb),
                ...(Object.keys(priceFilter).length > 0 && { harga: priceFilter }),
                schedule: {
                    flight: {
                        status: status_tiket,
                        bandara_keberangkatan: {
                            kode_bandara: bandara_keberangkatan
                        },
                        bandara_kedatangan: {
                            kode_bandara: bandara_kedatangan
                        },
                        ...transitStatus
                    },
                    ...(startOfTanggalPergi && endOfTanggalPergi && {
                        keberangkatan: {
                            gte: new Date(startOfTanggalPergi),
                            lt: new Date(endOfTanggalPergi)
                        }
                    }),
                    ...(startOfTanggalPulang && endOfTanggalPulang && {
                        kedatangan: {
                            gte: startOfTanggalPulang,
                            lt: endOfTanggalPulang
                        }
                    })
                }
            },
            select: {
                id: true,
                kelas: true,
                harga: true,
                jumlah: true,
                schedule: {
                    select: {
                        keberangkatan: true,
                        kedatangan: true,
                        flight: {
                            select: {
                                bandara_keberangkatan: true,
                                bandara_kedatangan: true,
                                terminal_keberangkatan: true,
                                terminal_kedatangan: true,
                                status: true,
                                Transit: {
                                    select: {
                                        airport: {
                                            select: {
                                                nama_bandara: true,
                                                kode_bandara: true,
                                                lokasi: true
                                            }
                                        }
                                    }
                                },
                                Plane: {
                                    select: {
                                        kode_pesawat: true,
                                        model_pesawat: true,
                                        bagasi_kabin: true,
                                        bagasi: true,
                                        jarak_kursi: true,
                                        jumlah_kursi: true,
                                        Airline: {
                                            select: {
                                                kode_maskapai: true,
                                                nama_maskapai: true,
                                                logo_maskapai: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            take: pagination.page_size,
            skip: (pagination.current_page - 1) * pagination.page_size
        });

        const data = tickets.map(ticket => {
            const hasTransit = ticket.schedule?.flight?.Transit && ticket.schedule.flight.Transit.length > 0;
            return {
                id: ticket.id,
                class: ticket.kelas,
                price: ticket.harga,
                status: ticket.schedule.flight.status,
                jumlah: ticket.jumlah,
                transit_status: hasTransit,
                schedule: {
                    takeoff: {
                        time: ticket.schedule.keberangkatan,
                        airport_code: ticket.schedule.flight.bandara_keberangkatan.kode_bandara,
                        airport_name: ticket.schedule.flight.bandara_keberangkatan.nama_bandara,
                        terminal: ticket.schedule.flight.terminal_keberangkatan
                    },
                    landing: {
                        time: ticket.schedule.kedatangan,
                        airport_code: ticket.schedule.flight.bandara_kedatangan.kode_bandara,
                        airport_name: ticket.schedule.flight.bandara_kedatangan.nama_bandara,
                        terminal: ticket.schedule.flight.terminal_kedatangan
                    },
                    transit: ticket.schedule.flight.Transit.map(transit => {
                        return {
                            airport_code: transit.airport.kode_bandara,
                            airport_name: transit.airport.nama_bandara,
                            location: transit.airport.lokasi
                        };
                    })
                },
                plane: {
                    airline_name: ticket.schedule.flight.Plane.Airline.nama_maskapai,
                    code: ticket.schedule.flight.Plane.kode_pesawat,
                    model: ticket.schedule.flight.Plane.model_pesawat,
                    baggage: ticket.schedule.flight.Plane.bagasi,
                    cabin_baggage: ticket.schedule.flight.Plane.bagasi_kabin,
                    logo: ticket.schedule.flight.Plane.Airline.logo_maskapai
                }
            };
        });

        return res.status(200).json({
            status: true,
            message: "Tickets retrieved successfully",
            data: data,
            pagination: pagination
        });
    } catch (error) {
        next(error);
    }
};

const getTicketById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const ticket = await prisma.ticket.findUnique({
            where: {
                id: parseInt(id)
            },
            select: {
                id: true,
                kelas: true,
                harga: true,
                jumlah: true,
                schedule: {
                    select: {
                        keberangkatan: true,
                        kedatangan: true,
                        flight: {
                            select: {
                                bandara_keberangkatan: true,
                                bandara_kedatangan: true,
                                terminal_keberangkatan: true,
                                status: true,
                                Transit: {
                                    select: {
                                        airport: {
                                            select: {
                                                nama_bandara: true,
                                                kode_bandara: true,
                                                lokasi: true
                                            }
                                        }
                                    }
                                },
                                Plane: {
                                    select: {
                                        kode_pesawat: true,
                                        model_pesawat: true,
                                        bagasi_kabin: true,
                                        bagasi: true,
                                        jarak_kursi: true,
                                        jumlah_kursi: true,
                                        Airline: {
                                            select: {
                                                kode_maskapai: true,
                                                nama_maskapai: true,
                                                logo_maskapai: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!ticket) {
            return res.status(404).json({
                status: false,
                message: "Ticket not found"
            });
        }

        const data = {
            id: ticket.id,
            class: ticket.kelas,
            price: ticket.harga,
            status: ticket.schedule.flight.status,
            jumlah: ticket.jumlah,
            schedule: {
                takeoff: {
                    time: ticket.schedule.keberangkatan,
                    airport_code: ticket.schedule.flight.bandara_keberangkatan.kode_bandara,
                    airport_name: ticket.schedule.flight.bandara_keberangkatan.nama_bandara
                },
                landing: {
                    time: ticket.schedule.kedatangan,
                    airport_code: ticket.schedule.flight.bandara_kedatangan.kode_bandara,
                    airport_name: ticket.schedule.flight.bandara_kedatangan.nama_bandara
                },
                transit: ticket.schedule.flight.Transit.map(transit => {
                    return {
                        airport_code: transit.airport.kode_bandara,
                        airport_name: transit.airport.nama_bandara,
                        location: transit.airport.lokasi
                    };
                }),
                plane: {
                    airline_name: ticket.schedule.flight.Plane.Airline.nama_maskapai,
                    code: ticket.schedule.flight.Plane.kode_pesawat,
                    model: ticket.schedule.flight.Plane.model_pesawat,
                    baggage: ticket.schedule.flight.Plane.bagasi,
                    cabin_baggage: ticket.schedule.flight.Plane.bagasi_kabin,
                    logo: ticket.schedule.flight.Plane.Airline.logo_maskapai
                }
            }
        };

        return res.status(200).json({
            status: true,
            message: "Ticket retrieved successfully",
            data: data
        });

    } catch (error) {
        next(error);
    }
};

const createTicket = async (req, res, next) => {
    const { bandara_kedatangan_id, bandara_keberangkatan_id, terminal_keberangkatan, terminal_kedatangan, transit, status, plane_id, jadwal_keberangkatan, jadwal_kedatangan, kelas, harga, bagasi, makanan, hiburan, wifi, usb, jumlah } = req.body;

    const transitData = transit.map(airportId => ({ airportId }));

    await prisma.flight.create({
        data: {
            bandara_keberangkatan_id: bandara_keberangkatan_id,
            bandara_kedatangan_id: bandara_kedatangan_id,
            terminal_keberangkatan,
            terminal_kedatangan,
            status,
            planeId: plane_id,
            Transit: {
                create: transitData
            },
            Schedule: {
                create: {
                    keberangkatan: jadwal_keberangkatan,
                    kedatangan: jadwal_kedatangan,
                    Ticket: {
                        create: {
                            kelas,
                            harga,
                            bagasi,
                            makanan,
                            hiburan,
                            wifi,
                            usb,
                            jumlah
                        }
                    }
                }
            }
        }
    });

    return res.status(200).json({
        status: true,
        message: "Ticket created successfully"
    });
};

module.exports = {
    getAllTickets,
    getTicketById,
    createTicket
};
