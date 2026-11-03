// Searches on submit (Enter), not on every keystroke, so typing doesn't fire a request per letter.
export function SearchBox({ value, onSearch, placeholder }: { value: string; onSearch: (q: string) => void; placeholder: string }) {
  return (
    <form
      key={value}
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(String(new FormData(e.currentTarget).get("q") ?? "").trim());
      }}
    >
      <input className="input w-64" name="q" type="search" defaultValue={value} placeholder={placeholder} />
      <button className="btn">Search</button>
    </form>
  );
}
