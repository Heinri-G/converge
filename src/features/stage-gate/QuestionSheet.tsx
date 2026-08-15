import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { DomainBranch, GateAnswer, GateQuestion } from '@/lib/types'
import { Progress } from './Progress'
import { Tooltip } from './Tooltip'

interface QuestionSheetProps {
  question: GateQuestion
  branch: DomainBranch
  branchPathLength: number
  maxDepth: number
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  onAnswer: (answer: GateAnswer) => void
}

function AnswerButtons({ question, onAnswer }: Pick<QuestionSheetProps, 'question' | 'onAnswer'>) {
  if (question.answerType === 'boolean') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left"
          onClick={() => onAnswer(true)}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left"
          onClick={() => onAnswer(false)}
        >
          No
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {question.options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="outline"
          className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left"
          onClick={() => onAnswer(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function QuestionContent({
  question,
  branch,
  branchPathLength,
  maxDepth,
  onAnswer,
}: Omit<QuestionSheetProps, 'mobileOpen' | 'onMobileOpenChange'>) {
  return (
    <>
      <Progress
        label={`Fold depth · ${branch.label}`}
        value={(branchPathLength / maxDepth) * 100}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            One decision at a time
          </p>
          <h2 className="max-w-[34rem] text-xl leading-tight font-semibold tracking-tight text-balance">
            {question.prompt}
          </h2>
        </div>
        <Tooltip text={question.tooltip} />
      </div>
      <div className="space-y-2" aria-label="Answer choices">
        <p className="text-sm text-muted-foreground">
          Choose the answer that fits your actual routine.
        </p>
        <AnswerButtons question={question} onAnswer={onAnswer} />
      </div>
    </>
  )
}

export function QuestionSheet({
  question,
  branch,
  branchPathLength,
  maxDepth,
  mobileOpen,
  onMobileOpenChange,
  onAnswer,
}: QuestionSheetProps) {
  return (
    <>
      <div className="hidden md:block">
        <Card className="gap-6 border border-border py-5 shadow-none">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="text-base">Adaptive mapping</CardTitle>
            <CardDescription>The next fold follows the variable you just answered.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-5">
            <QuestionContent
              question={question}
              branch={branch}
              branchPathLength={branchPathLength}
              maxDepth={maxDepth}
              onAnswer={onAnswer}
            />
          </CardContent>
        </Card>
      </div>

      <div className="md:hidden">
        {!mobileOpen && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => onMobileOpenChange(true)}
          >
            Reopen current question
          </Button>
        )}
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent
            side="bottom"
            showCloseButton
            overlayClassName="md:hidden"
            className="max-h-[calc(100dvh-4.5rem)] gap-0 overflow-y-auto rounded-t-xl border-border bg-card px-4 pb-[calc(var(--safe-bottom)+1rem)] pt-5 md:hidden"
          >
            <SheetHeader className="px-0 pb-5 pr-12">
              <SheetTitle>Adaptive mapping</SheetTitle>
              <SheetDescription>
                One answer folds the research toward a useful tier.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6">
              <QuestionContent
                question={question}
                branch={branch}
                branchPathLength={branchPathLength}
                maxDepth={maxDepth}
                onAnswer={onAnswer}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
