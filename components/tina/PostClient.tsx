"use client";

import { useTina } from "tinacms/dist/react";
import { TinaMarkdown, TinaMarkdownContent } from "tinacms/dist/rich-text";
import type { PostQuery, PostQueryVariables } from "../../tina/__generated__/types";

interface PostClientProps {
  data: PostQuery;
  query: string;
  variables: PostQueryVariables;
}

function fmt(input: string) {
  return new Date(input).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function PostClient(props: PostClientProps) {
  const res = useTina({ query: props.query, variables: props.variables, data: props.data });
  const post = res.data.post;
  return (
    <>
      <p className="meta">{fmt(post?.date || "")}</p>
      <h1>{post?.title || "Post"}</h1>
      <TinaMarkdown content={post?.body as TinaMarkdownContent} />
    </>
  );
}
