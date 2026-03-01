export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Supervisor-Agreed Run Sheet
      </h1>
      <p className="max-w-md text-center text-zinc-600">
        Open the link shared by your project owner to view and manage the run
        sheet. If you don’t have a link, request one from the project owner.
      </p>
    </div>
  );
}
