'use client'

import Image from "next/image"
import { useTina } from 'tinacms/dist/react'
import { TinaMarkdown, TinaMarkdownContent, Components } from "tinacms/dist/rich-text"
import type { PostQuery, PostQueryVariables } from "../../tina/__generated__/types"
import ThemeImage from "../ThemeImage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface PostClientProps {
  data: PostQuery
  query: string
  variables: PostQueryVariables
}

const components: Components<{
  ThemeImage: { lightSrc: string; darkSrc: string; alt: string }
}> = {
  ThemeImage: (props) => (
    <ThemeImage lightSrc={props.lightSrc} darkSrc={props.darkSrc} alt={props.alt} />
  ),
}

function reformatDate(fullDate: string): string {
  const date = new Date(fullDate)
  return date.toDateString().slice(4)
}

export default function PostClient(props: PostClientProps) {
  const { data } = useTina({
    query: props.query,
    variables: props.variables,
    data: props.data,
  })

  return (
    <article className="flex flex-col items-center gap-8">
      {/* Hero image */}
      <Card className="w-full overflow-hidden">
        <Image
          width={800}
          height={450}
          src={data.post?.hero_image || ""}
          alt={data.post?.title || "No Title"}
          className="w-full h-auto"
        />
      </Card>

      {/* Post info */}
      <CardHeader className="w-full text-center px-0">
        <CardTitle className="text-3xl font-bold">
          {data.post?.title || "Article Title Not found"}
        </CardTitle>
        <CardDescription className="text-base">
          {reformatDate(data.post?.date || "NO DATE")}
        </CardDescription>
      </CardHeader>

      <Separator />

      {/* Post body */}
      <div className="prose prose-invert max-w-none w-full">
        <TinaMarkdown content={data.post?.body as TinaMarkdownContent} components={components} />
      </div>
    </article>
  )
}
