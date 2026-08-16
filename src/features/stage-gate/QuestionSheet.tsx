import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { GateAnswer, GateQuestion } from '@/lib/types'
import { useIsMobile } from '@/lib/use-is-mobile'
import { Progress } from './Progress'
import { Tooltip } from './Tooltip'

interface QuestionSheetProps {
  question: GateQuestion
  answered: number
  maxDepth: number
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  onAnswer: (answer: GateAnswer) => void
  onFastTrack: () => void
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
  answered,
  maxDepth,
  onAnswer,
}: Omit<QuestionSheetProps, 'mobileOpen' | 'onMobileOpenChange' | 'onFastTrack'>) {
  const current = Math.min(answered + 1, maxDepth)
  return (
    <>
      <Progress label={`Question ${current} of ${maxDepth}`} value={(answered / maxDepth) * 100} />
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

function FastTrackRow({ onFastTrack }: { onFastTrack: () => void }) {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className="min-h-12 w-full border border-border text-muted-foreground hover:text-foreground"
        onClick={onFastTrack}
      >
        Skip the questions — show me top options now
      </Button>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <p>You can jump to results anytime.</p>
        <Tooltip text="Searches more broadly using just your prompt." />
      </div>
    </div>
  )
}

export function QuestionSheet({
  question,
  answered,
  maxDepth,
  mobileOpen,
  onMobileOpenChange,
  onAnswer,
  onFastTrack,
}: QuestionSheetProps) {
  const isMobile = useIsMobile()

  return (
    <>
      <div className="hidden md:block">
        <Card className="gap-6 border border-border py-5 shadow-none">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="text-base">A couple of quick questions</CardTitle>
            <CardDescription>
              Your answers steer the search toward the right options.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-5">
            <QuestionContent
              question={question}
              answered={answered}
              maxDepth={maxDepth}
              onAnswer={onAnswer}
            />
            <FastTrackRow onFastTrack={onFastTrack} />
          </CardContent>
        </Card>
      </div>

      {isMobile && (
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
              className="max-h-[calc(100dvh-4.5rem)] flex-col gap-0 overflow-hidden rounded-t-xl border-border bg-card px-0 pt-0 pb-0 md:hidden"
            >
              <SheetHeader className="shrink-0 gap-1 px-4 pt-5 pr-12 pb-4">
                <SheetTitle>A couple of quick questions</SheetTitle>
                <SheetDescription>
                  Your answers steer the search toward the right options.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
                <QuestionContent
                  question={question}
                  answered={answered}
                  maxDepth={maxDepth}
                  onAnswer={onAnswer}
                />
              </div>
              <div className="shrink-0 border-t border-border px-4 pt-3 pb-[calc(var(--safe-bottom)+1rem)]">
                <FastTrackRow onFastTrack={onFastTrack} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </>
  )
}
