'use client'

import { useTina } from 'tinacms/dist/react'
import { TinaMarkdown, TinaMarkdownContent } from "tinacms/dist/rich-text"
import type { AboutQuery, AboutQueryVariables } from "../../tina/__generated__/types"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface AboutClientProps {
  data: AboutQuery
  query: string
  variables: AboutQueryVariables
}

function reformatDate(fullDate: string | null | undefined): string {
  if (!fullDate) return "Present"
  const date = new Date(fullDate)
  return `${date.getMonth() + 1}/${date.getFullYear()}`
}

export default function AboutClient(props: AboutClientProps) {
  const { data } = useTina({
    query: props.query,
    variables: props.variables,
    data: props.data,
  })

  return (
    <article className="flex flex-col items-center gap-8">
      {data?.about?.profile && (
        <Avatar className="size-32 border-4 border-primary/20">
          <AvatarImage src={data.about.profile} alt="Kaio Barbosa-Chifan" />
          <AvatarFallback className="text-2xl">KB</AvatarFallback>
        </Avatar>
      )}

      <div className="prose prose-invert max-w-none w-full">
        <TinaMarkdown content={data?.about?.body as TinaMarkdownContent} />
      </div>

      <Separator className="my-4" />

      <div className="flex w-full flex-col gap-4">
        {data?.about?.experience?.map((exp, i) => (
          <Card
            key={i}
            className={`transition-opacity ${exp.hasPassed ? 'opacity-70' : ''}`}
          >
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">{exp.title}</h2>
                <Badge variant={exp.hasPassed ? "secondary" : "default"}>
                  {exp.showStartDate && reformatDate(exp.dateStart)}
                  {exp.showEndDate && ` – ${reformatDate(exp.dateEnd)}`}
                  {!exp.hasPassed && !exp.showEndDate && " – Present"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground" style={{ whiteSpace: 'pre-line' }}>
                {exp?.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </article>
  )
}
