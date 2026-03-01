import Link from "next/link";

export default function InvalidLinkPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-6">
      <h1 className="text-xl font-semibold text-zinc-900">
        Invalid or expired link
      </h1>
      <p className="max-w-md text-center text-zinc-600">
        This run sheet link is missing, invalid, or has expired. Please request
        a new link from the project owner.
      </p>
      <Link
        href="/"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Back to home
      </Link>
    </div>
  );
}
