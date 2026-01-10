import Link from "next/link";

export const dynamic = "force-dynamic";

const buildQueryString = (searchParams) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
      continue;
    }

    if (value != null) query.append(key, value);
  }

  return query.toString();
};

export default function DashboardPage({ searchParams }) {
  const queryString = buildQueryString(searchParams);
  const intakeHref = queryString ? `/intake?${queryString}` : "/intake";
  const shop = (searchParams?.shop || "").toString();

  return (
    <main className="intake-shell cardTight">
      <header className="intakeHeaderBar">
        <div />
        <div className="intakeHeaderCenter">
          <h1 className="intakeTitle">Dashboard</h1>
          <div className="intakeSub">STREET COMMERCE</div>
        </div>
        <div />
      </header>

      <section className="intake-section">
        <div className="section-heading">
          <div>
            <h2>Inventory Intake</h2>
            {shop ? <p className="hint">{shop}</p> : null}
          </div>
        </div>

        <Link className="primary-button" href={intakeHref}>
          Open Inventory Intake
        </Link>
      </section>
    </main>
  );
}
