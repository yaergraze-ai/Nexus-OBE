export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat portal akademik">
      <div className="loading-head" role="status">
        <span className="spinner-ring" aria-hidden="true" />
        <span>Memuat halaman portal...</span>
      </div>
      <div className="skeleton" style={{ width: 160, height: 12, marginBottom: 19 }} />
      <div
        className="skeleton"
        style={{ width: "min(360px,90%)", height: 34, marginBottom: 22 }}
      />
      <div
        className="skeleton"
        style={{ height: 190, borderRadius: 18, marginBottom: 22 }}
      />
      <div className="metrics">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="panel" key={i}>
            <div className="skeleton" style={{ width: 38, height: 38, marginBottom: 18 }} />
            <div className="skeleton" style={{ width: 110, height: 12, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 64, height: 28 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
