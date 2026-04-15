
'use server';

const NASA_BASE = 'https://api.nasa.gov';

function nasaApiKey(inputs: any): string {
    return String(inputs.apiKey ?? 'DEMO_KEY').trim() || 'DEMO_KEY';
}

async function nasaFetch(url: string, logger: any): Promise<any> {
    logger.log(`[NASA] GET ${url.replace(/api_key=[^&]+/, 'api_key=***')}`);
    const res = await fetch(url);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.msg || data?.error?.message || data?.error || `NASA API error: ${res.status}`);
    return data;
}

export async function executeNasaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = nasaApiKey(inputs);

        switch (actionName) {
            case 'getApod': {
                const date = inputs.date ? `&date=${inputs.date}` : '';
                const hd = inputs.hd === true || inputs.hd === 'true' ? 'true' : 'false';
                const url = `${NASA_BASE}/planetary/apod?hd=${hd}${date}&api_key=${apiKey}`;
                const data = await nasaFetch(url, logger);
                return {
                    output: {
                        title: data.title ?? '',
                        date: data.date ?? '',
                        explanation: data.explanation ?? '',
                        url: data.url ?? '',
                        hdUrl: data.hdurl ?? '',
                        mediaType: data.media_type ?? '',
                        copyright: data.copyright ?? '',
                    },
                };
            }

            case 'getMarsPhotos': {
                const rover = String(inputs.rover ?? '').trim();
                if (!rover) throw new Error('rover is required.');
                const camera = inputs.camera ? `&camera=${inputs.camera}` : '';
                const sol = inputs.sol !== undefined ? `&sol=${inputs.sol}` : `&sol=1000`;
                const earthDate = inputs.earthDate ? `&earth_date=${inputs.earthDate}` : '';
                const page = `&page=${inputs.page ?? 1}`;
                const url = `${NASA_BASE}/mars-photos/api/v1/rovers/${rover}/photos?${sol}${earthDate}${camera}${page}&api_key=${apiKey}`;
                const data = await nasaFetch(url, logger);
                const photos = (data.photos ?? []).map((p: any) => ({
                    id: p.id,
                    imgSrc: p.img_src,
                    earthDate: p.earth_date,
                    rover: { name: p.rover?.name },
                    camera: { name: p.camera?.name, fullName: p.camera?.full_name },
                }));
                return { output: { photos } };
            }

            case 'getMarsManifest': {
                const rover = String(inputs.rover ?? '').trim();
                if (!rover) throw new Error('rover is required.');
                const url = `${NASA_BASE}/mars-photos/api/v1/manifests/${rover}?api_key=${apiKey}`;
                const data = await nasaFetch(url, logger);
                const m = data.photo_manifest ?? {};
                return {
                    output: {
                        photoManifest: {
                            name: m.name,
                            landingDate: m.landing_date,
                            launchDate: m.launch_date,
                            status: m.status,
                            maxSol: m.max_sol,
                            maxDate: m.max_date,
                            totalPhotos: m.total_photos,
                        },
                    },
                };
            }

            case 'getEpicImages': {
                const datePart = inputs.date ? `/date/${inputs.date}` : '';
                const url = `https://epic.gsfc.nasa.gov/api/natural${datePart}`;
                const data = await nasaFetch(url, logger);
                const images = (Array.isArray(data) ? data : []).map((img: any) => ({
                    identifier: img.identifier,
                    caption: img.caption,
                    image: img.image,
                    date: img.date,
                }));
                return { output: { images } };
            }

            case 'searchImages': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const mediaType = inputs.mediaType ?? 'image';
                const yearStart = inputs.yearStart ? `&year_start=${inputs.yearStart}` : '';
                const yearEnd = inputs.yearEnd ? `&year_end=${inputs.yearEnd}` : '';
                const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=${mediaType}${yearStart}${yearEnd}`;
                const data = await nasaFetch(url, logger);
                const items = (data.collection?.items ?? []).map((item: any) => ({
                    href: item.href,
                    data: (item.data ?? []).map((d: any) => ({
                        title: d.title,
                        description: d.description,
                        date_created: d.date_created,
                        center: d.center,
                    })),
                }));
                return { output: { items } };
            }

            case 'getNeoFeed': {
                const startDate = String(inputs.startDate ?? '').trim();
                const endDate = String(inputs.endDate ?? '').trim();
                if (!startDate) throw new Error('startDate is required.');
                if (!endDate) throw new Error('endDate is required.');
                const url = `${NASA_BASE}/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${apiKey}`;
                const data = await nasaFetch(url, logger);
                return {
                    output: {
                        elementCount: data.element_count ?? 0,
                        nearEarthObjects: data.near_earth_objects ?? {},
                    },
                };
            }

            case 'getAsteroid': {
                const asteroidId = String(inputs.asteroidId ?? '').trim();
                if (!asteroidId) throw new Error('asteroidId is required.');
                const url = `${NASA_BASE}/neo/rest/v1/neo/${asteroidId}?api_key=${apiKey}`;
                const data = await nasaFetch(url, logger);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        isPotentiallyHazardous: data.is_potentially_hazardous_asteroid,
                        estimatedDiameter: data.estimated_diameter ?? {},
                    },
                };
            }

            case 'getTechTransfer': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const url = `${NASA_BASE}/techtransfer/patent/?api_key=${apiKey}&engine&${query}`;
                const data = await nasaFetch(url, logger);
                return { output: { results: data.results ?? [] } };
            }

            case 'getDonki': {
                const type = inputs.type ?? 'CME';
                const startDate = inputs.startDate ? `?startDate=${inputs.startDate}` : '?startDate=';
                const endDate = inputs.endDate ? `&endDate=${inputs.endDate}` : '&endDate=';
                const url = `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/${type}${startDate}${endDate}`;
                const data = await nasaFetch(url, logger);
                return { output: { events: Array.isArray(data) ? data : [] } };
            }

            case 'getExoplanets': {
                const select = inputs.select ?? 'pl_name,hostname,pl_orbper,pl_rade';
                const where = inputs.where ? `WHERE ${inputs.where}` : '';
                const limit = inputs.limit ?? 25;
                const queryStr = `SELECT ${select} FROM pscomppars ${where} LIMIT ${limit}`;
                const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(queryStr)}&format=json`;
                const data = await nasaFetch(url, logger);
                return { output: { planets: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `NASA action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'NASA action failed.' };
    }
}
