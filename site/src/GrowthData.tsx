import { useState } from 'react';
import data from '../../data/yogic_insights.json';
import videos from '../../data/edited_videos.json';

type View = 'Performance' | 'Publication cohorts' | 'Posting patterns' | 'Selected edits';
type Row = { label: string; value: number; detail?: string };
const allVideos = [...videos.shortForm, ...videos.longForm, ...videos.aiVisuals];

export default function GrowthData() {
  const [view, setView] = useState<View>('Performance');
  const [indian, setIndian] = useState(false);
  const number = (value: number) => indian
    ? value >= 1e7 ? `${(value / 1e7).toFixed(2)}Cr` : value >= 1e5 ? `${(value / 1e5).toFixed(2)}L` : value.toLocaleString('en-IN')
    : value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `${Math.round(value / 1e3)}K` : String(value);
  let title = 'A repeatable body of work.';
  let description = '149 unique videos grouped by lifetime views. 125 passed 100,000 views; 21 passed one million.';
  let rows: Row[] = Object.entries(data.distribution).map(([label, value]) => ({ label, value }));
  let unit = 'Videos';
  if (view === 'Publication cohorts') {
    title = 'Lifetime views, by publication month.';
    description = 'Each bar groups videos by when they were posted. It shows their lifetime views as of September 2026, not views earned during that month.';
    rows = data.months.filter(month => month.uniquePosts > 0).map(month => ({ label: new Date(`${month.m}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), value: month.uniqueViews, detail: `${month.uniquePosts} unique videos` }));
    unit = 'Lifetime views';
  } else if (view === 'Posting patterns') {
    title = 'When the work went out.';
    description = 'Publishing activity by hour, in IST. This describes my posting pattern; it does not establish an ideal posting time for another audience.';
    rows = data.byHourIST.filter(hour => hour.count > 0).map(hour => ({ label: `${String(hour.hourIST).padStart(2, '0')}:00`, value: hour.count, detail: `${number(hour.medianViews)} median lifetime views` }));
    unit = 'Videos';
  } else if (view === 'Selected edits') {
    title = '13 edits. 11.7M lifetime views.';
    description = 'Public views of the showcased videos. Some long videos are partial edits; the individual credits show my contribution.';
    rows = [...allVideos].sort((a, b) => b.views - a.views).map(video => ({ label: video.title, value: video.views, detail: video.credit }));
    unit = 'Lifetime views';
  }
  const max = Math.max(...rows.map(row => row.value));
  return <div className="growth-content">
    <div className="growth-summary"><div><strong>149</strong><span>unique videos</span></div><div><strong>125</strong><span>passed {indian ? '1L' : '100K'} views</span></div><div><strong>21</strong><span>passed {indian ? '10L' : '1M'} views</span></div><div><strong>{number(268159)}</strong><span>median lifetime views</span></div></div>
    <div className="data-controls"><div className="data-tabs" role="group" aria-label="Choose dataset">{(['Performance', 'Publication cohorts', 'Posting patterns', 'Selected edits'] as View[]).map(item => <button key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item}</button>)}</div><button className="unit-toggle" onClick={() => setIndian(!indian)} aria-pressed={indian} aria-label="Use lakh and crore units">{indian ? 'Lakh / Crore' : 'Million / Thousand'}</button></div>
    <div className="chart-title"><h3>{title}</h3><p>{description}</p></div>
    <div className={`bar-chart ${view === 'Selected edits' ? 'wide-labels' : ''}`} aria-label={`${title} ${unit}`} role="figure">{rows.map(row => <div className="bar-row" key={row.label} tabIndex={0} aria-label={`${row.label}: ${number(row.value)} ${unit.toLowerCase()}${row.detail ? `. ${row.detail}` : ''}`}><span className="bar-label">{row.label}</span><div className="bar-track"><span style={{ width: `${Math.max(1, row.value / max * 100)}%` }} /></div><span className="bar-value">{number(row.value)}</span></div>)}</div>
    <details className="data-table"><summary>Read the data as a table</summary><div className="table-scroll"><table><caption>{title}</caption><thead><tr><th scope="col">{view === 'Publication cohorts' ? 'Published' : view === 'Posting patterns' ? 'Hour (IST)' : view === 'Selected edits' ? 'Video' : 'View range'}</th><th scope="col">{unit}</th>{rows.some(row => row.detail) && <th scope="col">Context</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value.toLocaleString(indian ? 'en-IN' : 'en-GB')}</td>{row.detail && <td>{row.detail}</td>}</tr>)}</tbody></table></div></details>
    <div className="data-source"><p>Source: supplied Meta Graph API export and public YouTube counts, 27 September 2026. All views are lifetime counts at extraction. Repeat Facebook posts are counted once.</p><a className="text-link" href={view === 'Selected edits' ? '/data/edited_videos.json' : '/data/yogic_insights.json'} download>Download source data</a></div>
  </div>;
}
