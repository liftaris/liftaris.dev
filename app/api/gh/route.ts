import { NextRequest, NextResponse } from "next/server";
import {
  getRepo,
  getContributionSnapshot,
  getActivityDigest,
  listShowcaseRepos,
} from "@/lib/github";

export async function GET(req: NextRequest) {
  const op = req.nextUrl.searchParams.get("op");

  switch (op) {
    case "repo": {
      const name = req.nextUrl.searchParams.get("name");
      if (!name) return NextResponse.json({ ok: false }, { status: 400 });
      return NextResponse.json(await getRepo(name));
    }
    case "snapshot":
      return NextResponse.json(await getContributionSnapshot());
    case "activity":
      return NextResponse.json(await getActivityDigest());
    case "showcase":
      return NextResponse.json(await listShowcaseRepos());
    default:
      return NextResponse.json({ ok: false }, { status: 400 });
  }
}
