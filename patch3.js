const fs = require('fs');
const file = 'src/app/dashboard/seo/site-explorer/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const startTag = '<div className="grid gap-8 md:grid-cols-2">';
const startIndex = content.indexOf(startTag);
const endTag = '</div>\n        </div>\n    );\n}';
const endIndex = content.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
  const newContent = `
            <div className="grid gap-8 md:grid-cols-2">
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Anchor Text Distribution</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="space-y-4">
                            {anchorTextData.map((item, index) => (
                                <div key={\`\${item.text}-\${index}\`} className="space-y-1">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-sm text-zoru-ink truncate">{item.text}</p>
                                        <p className="text-xs text-zoru-ink-muted">{item.percentage.toFixed(0)}%</p>
                                    </div>
                                    <Progress value={item.percentage} />
                                </div>
                            ))}
                        </div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Link Type Breakdown</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex justify-center items-center h-full min-h-[250px]">
                        <ChartContainer config={{ dofollow: { label: 'Dofollow', color: 'hsl(var(--chart-1))' }, nofollow: { label: 'Nofollow', color: 'hsl(var(--chart-2))' } }} className="w-full h-full max-h-[300px]">
                            <PieChart>
                                <Pie
                                    data={linkTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {linkTypeData.map((entry, index) => (
                                        <Cell key={\`cell-\${index}\`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <ChartTooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ChartContainer>
                    </ZoruCardContent>
                </Card>
            </div>

            <Card>
                <ZoruCardHeader className="flex flex-row items-center justify-between">
                    <ZoruCardTitle>Top Linking Domains</ZoruCardTitle>
                    <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!backlinks.length}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div ref={parentRef} className="h-[400px] overflow-auto border border-zoru-line rounded-[var(--zoru-radius)] bg-transparent">
                        <div className="w-full text-sm">
                            <div className="flex border-b border-zoru-line sticky top-0 bg-[var(--zoru-background)] z-10 font-medium">
                                <div className="p-3 w-1/2 text-left text-zoru-ink">Domain / URL</div>
                                <div className="p-3 w-1/2 text-right text-zoru-ink">Type</div>
                            </div>
                            
                            <div style={{ height: \`\${rowVirtualizer.getTotalSize()}px\`, position: 'relative' }}>
                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const item = backlinks[virtualRow.index];
                                    return (
                                        <div
                                            key={virtualRow.key}
                                            className="flex border-b border-zoru-line absolute top-0 left-0 w-full items-center bg-transparent"
                                            style={{
                                                height: \`\${virtualRow.size}px\`,
                                                transform: \`translateY(\${virtualRow.start}px)\`
                                            }}
                                        >
                                            <div className="p-3 w-1/2 flex flex-col justify-center overflow-hidden">
                                                <span className="font-medium text-zoru-ink truncate">
                                                    {(() => {
                                                        try {
                                                            return new URL(item.sourceUrl).hostname;
                                                        } catch {
                                                            return item.sourceUrl;
                                                        }
                                                    })()}
                                                </span>
                                                <span className="text-xs text-zoru-ink-muted truncate">
                                                    {item.sourceUrl}
                                                </span>
                                            </div>
                                            <div className="p-3 w-1/2 text-right flex items-center justify-end">
                                                <Badge variant="outline">{item.linkType}</Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>
`;

  content = content.substring(0, startIndex) + newContent + '\n' + content.substring(endIndex);
  fs.writeFileSync(file, content);
  console.log('Patched layout');
} else {
  console.error('Tags not found');
}
