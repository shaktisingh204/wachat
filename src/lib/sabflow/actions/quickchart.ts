
'use server';

const QUICKCHART_BASE = 'https://quickchart.io';

function buildChartUrl(chartConfig: any, inputs: any, apiKey?: string): string {
    const width = inputs.width ?? 500;
    const height = inputs.height ?? 300;
    const backgroundColor = inputs.backgroundColor ?? 'white';
    const devicePixelRatio = inputs.devicePixelRatio ?? 1;
    const format = inputs.format ?? 'png';

    let url =
        `${QUICKCHART_BASE}/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}` +
        `&w=${width}&h=${height}&bkg=${encodeURIComponent(String(backgroundColor))}` +
        `&devicePixelRatio=${devicePixelRatio}&f=${format}`;

    if (apiKey) url += `&key=${encodeURIComponent(apiKey)}`;
    return url;
}

export async function executeQuickchartAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string | undefined = inputs.apiKey ? String(inputs.apiKey).trim() : undefined;

        switch (actionName) {
            case 'generateChartUrl': {
                if (!inputs.chartConfig) throw new Error('chartConfig is required.');
                const chartConfig =
                    typeof inputs.chartConfig === 'string'
                        ? JSON.parse(inputs.chartConfig)
                        : inputs.chartConfig;

                const url = buildChartUrl(chartConfig, inputs, apiKey);
                logger.log(`[QuickChart] Chart URL generated`);
                return { output: { url, downloadUrl: url } };
            }

            case 'generateBarChart': {
                if (!inputs.labels) throw new Error('labels is required.');
                if (!inputs.datasets) throw new Error('datasets is required.');

                const title = inputs.title;
                const chartConfig = {
                    type: 'bar',
                    data: { labels: inputs.labels, datasets: inputs.datasets },
                    options: { title: { display: !!title, text: title } },
                };
                const url = buildChartUrl(chartConfig, inputs, apiKey);
                logger.log(`[QuickChart] Bar chart URL generated`);
                return { output: { url } };
            }

            case 'generateLineChart': {
                if (!inputs.labels) throw new Error('labels is required.');
                if (!inputs.datasets) throw new Error('datasets is required.');

                const title = inputs.title;
                const chartConfig = {
                    type: 'line',
                    data: { labels: inputs.labels, datasets: inputs.datasets },
                    options: { title: { display: !!title, text: title } },
                };
                const url = buildChartUrl(chartConfig, inputs, apiKey);
                logger.log(`[QuickChart] Line chart URL generated`);
                return { output: { url } };
            }

            case 'generatePieChart': {
                if (!inputs.labels) throw new Error('labels is required.');
                if (!inputs.data) throw new Error('data is required.');

                const title = inputs.title;
                const chartConfig = {
                    type: 'pie',
                    data: { labels: inputs.labels, datasets: [{ data: inputs.data }] },
                    options: { title: { display: !!title, text: title } },
                };
                const url = buildChartUrl(chartConfig, inputs, apiKey);
                logger.log(`[QuickChart] Pie chart URL generated`);
                return { output: { url } };
            }

            case 'generateDoughnutChart': {
                if (!inputs.labels) throw new Error('labels is required.');
                if (!inputs.data) throw new Error('data is required.');

                const title = inputs.title;
                const chartConfig = {
                    type: 'doughnut',
                    data: { labels: inputs.labels, datasets: [{ data: inputs.data }] },
                    options: { title: { display: !!title, text: title } },
                };
                const url = buildChartUrl(chartConfig, inputs, apiKey);
                logger.log(`[QuickChart] Doughnut chart URL generated`);
                return { output: { url } };
            }

            case 'generateQrCode': {
                const text = String(inputs.text ?? '').trim();
                if (!text) throw new Error('text is required.');

                const size = inputs.size ?? 150;
                const darkColor = String(inputs.darkColor ?? '000000');
                const lightColor = String(inputs.lightColor ?? 'ffffff');
                const caption = inputs.caption ?? '';

                const qrUrl =
                    `${QUICKCHART_BASE}/qr?text=${encodeURIComponent(text)}` +
                    `&size=${size}&dark=${encodeURIComponent(darkColor)}&light=${encodeURIComponent(lightColor)}` +
                    `&caption=${encodeURIComponent(String(caption))}`;

                logger.log(`[QuickChart] QR code URL generated`);
                return { output: { qrUrl } };
            }

            case 'generateSparkline': {
                if (!inputs.data) throw new Error('data is required.');

                const chartConfig = {
                    type: 'sparkline',
                    data: {
                        datasets: [
                            {
                                data: inputs.data,
                                borderColor: inputs.lineColor ?? '#4bc0c0',
                                backgroundColor: inputs.fillColor ?? 'rgba(75,192,192,0.2)',
                                fill: true,
                            },
                        ],
                    },
                };
                const url = buildChartUrl(chartConfig, inputs, apiKey);
                logger.log(`[QuickChart] Sparkline URL generated`);
                return { output: { url } };
            }

            case 'generateWordCloud': {
                const words = String(inputs.words ?? '').trim();
                if (!words) throw new Error('words is required.');

                const body = {
                    format: 'png',
                    width: inputs.width ?? 500,
                    height: inputs.height ?? 500,
                    fontScale: inputs.fontScale ?? 25,
                    text: words,
                };

                logger.log(`[QuickChart] Generating word cloud`);
                const res = await fetch(`${QUICKCHART_BASE}/wordcloud`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`QuickChart word cloud error: ${res.status} - ${errText}`);
                }

                const arrayBuffer = await res.arrayBuffer();
                const imageBase64 = Buffer.from(arrayBuffer).toString('base64');
                return { output: { imageBase64, contentType: 'image/png' } };
            }

            case 'generateTable': {
                if (!inputs.columns) throw new Error('columns is required.');
                if (!inputs.rows) throw new Error('rows is required.');

                const chartConfig = {
                    type: 'table',
                    data: {
                        columns: inputs.columns,
                        rows: inputs.rows,
                    },
                    options: inputs.title ? { title: inputs.title } : {},
                };
                const url = buildChartUrl(chartConfig, inputs, apiKey);
                logger.log(`[QuickChart] Table chart URL generated`);
                return { output: { url } };
            }

            case 'downloadChart': {
                if (!inputs.chartConfig) throw new Error('chartConfig is required.');
                const chartConfig =
                    typeof inputs.chartConfig === 'string'
                        ? JSON.parse(inputs.chartConfig)
                        : inputs.chartConfig;

                const body = new URLSearchParams({
                    c: JSON.stringify(chartConfig),
                    w: String(inputs.width ?? 500),
                    h: String(inputs.height ?? 300),
                    f: String(inputs.format ?? 'png'),
                });
                if (apiKey) body.set('key', apiKey);

                logger.log(`[QuickChart] Downloading chart`);
                const res = await fetch(`${QUICKCHART_BASE}/chart`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: body.toString(),
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`QuickChart download error: ${res.status} - ${errText}`);
                }

                const arrayBuffer = await res.arrayBuffer();
                const imageBase64 = Buffer.from(arrayBuffer).toString('base64');
                const contentType = res.headers.get('content-type') ?? 'image/png';
                return { output: { imageBase64, contentType } };
            }

            case 'generateGauge': {
                if (inputs.value === undefined || inputs.value === null) throw new Error('value is required.');

                const value = Number(inputs.value);
                const min = inputs.min ?? 0;
                const max = inputs.max ?? 100;
                const valueLabel = inputs.valueLabel ?? String(value);
                const ranges = inputs.ranges ?? [
                    { backgroundColor: 'red', min: 0, max: 33 },
                    { backgroundColor: 'orange', min: 33, max: 66 },
                    { backgroundColor: 'green', min: 66, max: 100 },
                ];

                const chartConfig = {
                    type: 'gauge',
                    data: {
                        datasets: [{ value, data: [value - min, max - value], backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'] }],
                    },
                    options: {
                        valueLabel: { display: true, text: valueLabel },
                        minValue: min,
                        maxValue: max,
                        ranges,
                    },
                };
                const url = buildChartUrl(chartConfig, inputs, apiKey);
                logger.log(`[QuickChart] Gauge chart URL generated`);
                return { output: { url } };
            }

            default:
                return { error: `QuickChart action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'QuickChart action failed.' };
    }
}
