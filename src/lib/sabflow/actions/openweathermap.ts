'use server';

const OWM_BASE = 'https://api.openweathermap.org';

async function owmFetch(
    apiKey: string,
    path: string,
    params: Record<string, string | number | undefined>,
    logger: any,
) {
    const url = new URL(`${OWM_BASE}${path}`);
    url.searchParams.set('appid', apiKey);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
    logger.log(`[OpenWeatherMap] GET ${path}`);
    const res = await fetch(url.toString());
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || `OpenWeatherMap API error: ${res.status}`);
    return data;
}

export async function executeOpenWeatherMapAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const fetch_ = (path: string, params: Record<string, string | number | undefined>) =>
            owmFetch(apiKey, path, params, logger);

        switch (actionName) {
            case 'getCurrentWeather': {
                const units = String(inputs.units ?? 'metric');
                const params: Record<string, string | number | undefined> = { units };
                if (inputs.city) params.q = String(inputs.city);
                if (inputs.lat !== undefined && inputs.lat !== '') params.lat = inputs.lat;
                if (inputs.lon !== undefined && inputs.lon !== '') params.lon = inputs.lon;
                if (!params.q && (params.lat === undefined || params.lon === undefined)) {
                    throw new Error('Either city or both lat and lon are required.');
                }
                logger.log('[OpenWeatherMap] getCurrentWeather');
                const data = await fetch_('/data/2.5/weather', params);
                return {
                    output: {
                        city: data.name ?? '',
                        temp: data.main?.temp ?? null,
                        feels_like: data.main?.feels_like ?? null,
                        humidity: data.main?.humidity ?? null,
                        description: data.weather?.[0]?.description ?? '',
                        windSpeed: data.wind?.speed ?? null,
                        icon: data.weather?.[0]?.icon ?? '',
                    },
                };
            }

            case 'getForecast5Day': {
                const units = String(inputs.units ?? 'metric');
                const cnt = Number(inputs.cnt ?? 40);
                const params: Record<string, string | number | undefined> = { units, cnt };
                if (inputs.city) params.q = String(inputs.city);
                if (inputs.lat !== undefined && inputs.lat !== '') params.lat = inputs.lat;
                if (inputs.lon !== undefined && inputs.lon !== '') params.lon = inputs.lon;
                if (!params.q && (params.lat === undefined || params.lon === undefined)) {
                    throw new Error('Either city or both lat and lon are required.');
                }
                logger.log('[OpenWeatherMap] getForecast5Day');
                const data = await fetch_('/data/2.5/forecast', params);
                const forecast = (data.list ?? []).map((item: any) => ({
                    dt: item.dt,
                    temp: item.main?.temp ?? null,
                    description: item.weather?.[0]?.description ?? '',
                    icon: item.weather?.[0]?.icon ?? '',
                }));
                return { output: { city: data.city?.name ?? '', forecast } };
            }

            case 'getHourlyForecast': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                const units = String(inputs.units ?? 'metric');
                logger.log('[OpenWeatherMap] getHourlyForecast');
                const data = await fetch_('/data/3.0/onecall', { lat, lon, units, exclude: 'current,minutely,daily,alerts' });
                return { output: { hourly: data.hourly ?? [] } };
            }

            case 'getHistoricalData': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                const dt = inputs.dt;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                if (dt === undefined || dt === '') throw new Error('dt (Unix timestamp) is required.');
                logger.log('[OpenWeatherMap] getHistoricalData');
                const data = await fetch_('/data/3.0/onecall/timemachine', { lat, lon, dt });
                return { output: { data } };
            }

            case 'getWeatherByCoordinates': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                const units = String(inputs.units ?? 'metric');
                logger.log('[OpenWeatherMap] getWeatherByCoordinates');
                const data = await fetch_('/data/2.5/weather', { lat, lon, units });
                return {
                    output: {
                        city: data.name ?? '',
                        temp: data.main?.temp ?? null,
                        humidity: data.main?.humidity ?? null,
                        description: data.weather?.[0]?.description ?? '',
                        windSpeed: data.wind?.speed ?? null,
                    },
                };
            }

            case 'getAirPollution': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                logger.log('[OpenWeatherMap] getAirPollution');
                const data = await fetch_('/data/2.5/air_pollution', { lat, lon });
                const first = data.list?.[0] ?? {};
                return { output: { aqi: first.main?.aqi ?? null, components: first.components ?? {} } };
            }

            case 'getAirPollutionForecast': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                logger.log('[OpenWeatherMap] getAirPollutionForecast');
                const data = await fetch_('/data/2.5/air_pollution/forecast', { lat, lon });
                return { output: { list: data.list ?? [] } };
            }

            case 'getGeocoding': {
                const city = String(inputs.city ?? '').trim();
                if (!city) throw new Error('city is required.');
                const limit = Number(inputs.limit ?? 5);
                logger.log(`[OpenWeatherMap] getGeocoding: city=${city}`);
                const data = await fetch_('/geo/1.0/direct', { q: city, limit });
                const results = (Array.isArray(data) ? data : []).map((r: any) => ({
                    name: r.name, lat: r.lat, lon: r.lon, country: r.country, state: r.state ?? '',
                }));
                return { output: { results } };
            }

            case 'getReverseGeocoding': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                const limit = Number(inputs.limit ?? 1);
                logger.log('[OpenWeatherMap] getReverseGeocoding');
                const data = await fetch_('/geo/1.0/reverse', { lat, lon, limit });
                const results = (Array.isArray(data) ? data : []).map((r: any) => ({
                    name: r.name, country: r.country, state: r.state ?? '',
                }));
                return { output: { results } };
            }

            case 'getUVIndex': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                logger.log('[OpenWeatherMap] getUVIndex');
                const data = await fetch_('/data/2.5/uvi', { lat, lon });
                return { output: { lat: data.lat ?? lat, lon: data.lon ?? lon, value: data.value ?? null, date: data.date_iso ?? data.date ?? null } };
            }

            case 'getOneCallWeather': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                const units = String(inputs.units ?? 'metric');
                const exclude = inputs.exclude ? String(inputs.exclude) : '';
                logger.log('[OpenWeatherMap] getOneCallWeather');
                const params: Record<string, string | number | undefined> = { lat, lon, units };
                if (exclude) params.exclude = exclude;
                const data = await fetch_('/data/3.0/onecall', params);
                return { output: { current: data.current ?? {}, daily: data.daily ?? [], hourly: data.hourly ?? [], alerts: data.alerts ?? [] } };
            }

            case 'getHeatIndex': {
                const city = String(inputs.city ?? '').trim();
                if (!city) throw new Error('city is required.');
                logger.log(`[OpenWeatherMap] getHeatIndex: city=${city}`);
                const data = await fetch_('/data/2.5/weather', { q: city, units: 'metric' });
                const temp = data.main?.temp ?? null;
                const humidity = data.main?.humidity ?? null;
                return { output: { city: data.name ?? city, temp, humidity, feels_like: data.main?.feels_like ?? null } };
            }

            case 'getWindSpeed': {
                const city = String(inputs.city ?? '').trim();
                if (!city) throw new Error('city is required.');
                logger.log(`[OpenWeatherMap] getWindSpeed: city=${city}`);
                const data = await fetch_('/data/2.5/weather', { q: city, units: String(inputs.units ?? 'metric') });
                return { output: { city: data.name ?? city, windSpeed: data.wind?.speed ?? null, windDeg: data.wind?.deg ?? null, windGust: data.wind?.gust ?? null } };
            }

            case 'getHumidity': {
                const city = String(inputs.city ?? '').trim();
                if (!city) throw new Error('city is required.');
                logger.log(`[OpenWeatherMap] getHumidity: city=${city}`);
                const data = await fetch_('/data/2.5/weather', { q: city });
                return { output: { city: data.name ?? city, humidity: data.main?.humidity ?? null } };
            }

            case 'getClimateData': {
                const lat = inputs.lat;
                const lon = inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lon === undefined || lon === '') throw new Error('lon is required.');
                logger.log('[OpenWeatherMap] getClimateData');
                const data = await fetch_('/data/3.0/onecall', { lat, lon, exclude: 'current,minutely,hourly,alerts' });
                return { output: { daily: data.daily ?? [] } };
            }

            default:
                return { error: `OpenWeatherMap action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'OpenWeatherMap action failed.' };
    }
}
