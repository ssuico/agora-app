import { PreviewFrame } from './PreviewFrame';

function DashboardMock() {
  const tiles = [
    { label: 'Revenue', value: '$1,240' },
    { label: 'Profit', value: '$386' },
    { label: 'Orders', value: '28' },
  ];
  const bars = [40, 65, 48, 80, 55, 72, 90];
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 text-[11px] text-foreground">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">Store Dashboard</p>
        <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success-ink">Open</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-md border border-border bg-muted px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">{tile.label}</p>
            <p className="font-semibold tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex h-14 items-end gap-1 rounded-md border border-border px-2 py-1.5">
        {bars.map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-sm bg-chart-1"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground">Top Products</p>
          <p className="mt-1 flex justify-between"><span>Trail Mix</span><span className="tabular-nums">42</span></p>
          <p className="flex justify-between"><span>Camp Mug</span><span className="tabular-nums">19</span></p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground">Activity</p>
          <p className="mt-1 truncate">Alex reserved Trail Mix</p>
          <p className="truncate">Jordan claimed Camp Mug</p>
        </div>
      </div>
    </div>
  );
}

function InventoryMock() {
  const rows = [
    { name: 'Trail Mix', qty: '86', tone: 'bg-operational-subtle text-operational' },
    { name: 'Camp Mug', qty: '6', tone: 'bg-warning-soft text-warning-ink' },
    { name: 'Fire Starter', qty: '0', tone: 'bg-error-soft text-error-ink' },
  ];
  const tabs = ['Inventory', 'Realtime Stocks', 'Report', 'History'];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-[11px] text-foreground">
      <div className="flex gap-1 overflow-hidden border-b border-border px-2 py-1.5">
        {tabs.map((tab, index) => (
          <span
            key={tab}
            className={`truncate rounded-md px-1.5 py-0.5 ${index === 0 ? 'bg-primary-subtle font-semibold' : 'text-muted-foreground'}`}
          >
            {tab}
          </span>
        ))}
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5 last:border-b-0">
            <span className="truncate">{row.name}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${row.tone}`}>
              {row.qty}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrdersMock() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-[11px] text-foreground">
      <div className="border-b border-border px-2.5 py-2">
        <p className="text-xs font-semibold">Pre-Orders</p>
        <p className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate">Summit Kit · closes 6:00 PM</span>
          <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-ink">
            pending
          </span>
        </p>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold">Transactions</p>
        <div className="mt-1.5 flex gap-1">
          <span className="rounded-md bg-primary-subtle px-1.5 py-0.5 font-semibold">Registered</span>
          <span className="rounded-md px-1.5 py-0.5 text-muted-foreground">Walk-in</span>
        </div>
        <p className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate">Alex · Trail Mix</span>
          <span className="shrink-0 rounded-full bg-info-soft px-1.5 py-0.5 text-[10px] font-medium text-info-ink">
            cancellation
          </span>
        </p>
        <p className="mt-1.5 text-[10px] font-medium text-operational">Export today's report</p>
      </div>
    </div>
  );
}

export function ManagerPreviews() {
  return (
    <div className="flex flex-col gap-4">
      <PreviewFrame
        path="/store/ridge-outfitters"
        caption="The store dashboard: financial summary, charts, top products, and recent customer activity."
      >
        <DashboardMock />
      </PreviewFrame>
      <div className="grid gap-4 sm:grid-cols-2">
        <PreviewFrame
          path="/store/ridge-outfitters/products"
          caption="Inventory, realtime stocks, reports, and listing history. Stock badges flag low and empty items."
        >
          <InventoryMock />
        </PreviewFrame>
        <PreviewFrame
          path="/store/ridge-outfitters/transactions"
          caption="Pre-order listings with deadlines, registered and walk-in sales, and cancellation requests to review."
        >
          <OrdersMock />
        </PreviewFrame>
      </div>
    </div>
  );
}
