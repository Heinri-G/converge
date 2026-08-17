import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { GateAnswer, GeneratedGateGroup } from '@/lib/types'
import { useIsMobile } from '@/lib/use-is-mobile'
import { cn } from '@/lib/utils'
import { Progress } from './Progress'
import { Tooltip } from './Tooltip'

interface GroupSheetProps {
  group: GeneratedGateGroup
  groupIndex: number
  totalGroups: number
  answers: Record<string, GateAnswer>
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  onAnswer: (questionId: string, answer: GateAnswer) => void
  onContinue: () => void
  onFastTrack: () => void
  onStartFresh?: () => void
}

function BooleanButtons({
  selected,
  onAnswer,
}: {
  selected: GateAnswer | undefined
  onAnswer: (answer: GateAnswer) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {[true, false].map((value) => (
        <Button
          key={String(value)}
          type="button"
          variant={selected === value ? 'default' : 'outline'}
          className="h-auto min-h-11 justify-start px-4 py-3 text-left"
          onClick={() => onAnswer(value)}
        >
          {value ? 'Yes' : 'No'}
        </Button>
      ))}
    </div>
  )
}

function OptionButtons({
  question,
  selected,
  onAnswer,
}: {
  question: GeneratedGateGroup['questions'][number]
  selected: GateAnswer | undefined
  onAnswer: (answer: GateAnswer) => void
}) {
  return (
    <div className="grid gap-2">
      {question.options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={selected === option.value ? 'default' : 'outline'}
          className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left"
          onClick={() => onAnswer(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function QuestionBlock({
  question,
  answers,
  onAnswer,
}: {
  question: GeneratedGateGroup['questions'][number]
  answers: Record<string, GateAnswer>
  onAnswer: (questionId: string, answer: GateAnswer) => void
}) {
  const selected = answers[question.id]
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base leading-snug font-semibold tracking-tight text-balance">
          {question.prompt}
        </h3>
        <Tooltip text={question.tooltip} />
      </div>
      {question.answerType === 'boolean' ? (
        <BooleanButtons selected={selected} onAnswer={(a) => onAnswer(question.id, a)} />
      ) : (
        <OptionButtons question={question} selected={selected} onAnswer={(a) => onAnswer(question.id, a)} />
      )}
    </div>
  )
}

function GroupContent({
  group,
  groupIndex,
  totalGroups,
  answers,
  onAnswer,
}: Omit<GroupSheetProps, 'mobileOpen' | 'onMobileOpenChange' | 'onContinue' | 'onFastTrack' | 'onStartFresh'>) {
  return (
    <>
      <Progress
        label={`Step ${groupIndex + 1} of ${totalGroups}`}
        value={(groupIndex / Math.max(1, totalGroups)) * 100}
      />
      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          {group.title}
        </p>
        <h2 className="max-w-[34rem] text-xl leading-tight font-semibold tracking-tight text-balance">
          {group.rationale}
        </h2>
      </div>
      <div className={cn('space-y-5', group.questions.length > 1 && 'border-t border-border pt-5')}>
        {group.questions.map((question) => (
          <QuestionBlock key={question.id} question={question} answers={answers} onAnswer={onAnswer} />
        ))}
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

function StartFreshRow({ onStartFresh }: { onStartFresh: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11 w-full text-muted-foreground hover:text-foreground"
      onClick={onStartFresh}
    >
      Start over — clear saved progress
    </Button>
  )
}

export function GroupSheet({
  group,
  groupIndex,
  totalGroups,
  answers,
  mobileOpen,
  onMobileOpenChange,
  onAnswer,
  onContinue,
  onFastTrack,
  onStartFresh,
}: GroupSheetProps) {
  const isMobile = useIsMobile()
  const allAnswered = group.questions.every((question) => answers[question.id] !== undefined)
  const contentProps = {
    group,
    groupIndex,
    totalGroups,
    answers,
    onAnswer,
  }

  return (
    <>
      <div className="hidden md:block">
        <Card className="gap-6 border border-border py-5 shadow-none">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="text-base">A few quick questions</CardTitle>
            <CardDescription>
              Prepared from your request — only what's still missing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-5">
            <GroupContent {...contentProps} />
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={!allAnswered}
              onClick={onContinue}
            >
              {allAnswered ? 'Continue' : 'Answer the questions above to continue'}
            </Button>
            <FastTrackRow onFastTrack={onFastTrack} />
            {onStartFresh && <StartFreshRow onStartFresh={onStartFresh} />}
          </CardContent>
        </Card>
      </div>

      {isMobile && (
        <div className="md:hidden">
          {!mobileOpen && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => onMobileOpenChange(true)}
              >
                Reopen current questions
              </Button>
              {onStartFresh && <StartFreshRow onStartFresh={onStartFresh} />}
            </div>
          )}
          <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
            <SheetContent
              side="bottom"
              showCloseButton
              overlayClassName="md:hidden"
              className="max-h-[calc(100dvh-4.5rem)] flex-col gap-0 overflow-hidden rounded-t-xl border-border bg-card px-0 pt-0 pb-0 md:hidden"
            >
              <SheetHeader className="shrink-0 gap-1 px-4 pt-5 pr-12 pb-4">
                <SheetTitle>A few quick questions</SheetTitle>
                <SheetDescription>Prepared from your request — only what's still missing.</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
                <GroupContent {...contentProps} />
              </div>
              <div className="shrink-0 border-t border-border px-4 pt-3 pb-[calc(var(--safe-bottom)+1rem)]">
                <Button
                  type="button"
                  className="min-h-11 w-full"
                  disabled={!allAnswered}
                  onClick={onContinue}
                >
                  {allAnswered ? 'Continue' : 'Answer the questions above to continue'}
                </Button>
                <div className="mt-2">
                  <FastTrackRow onFastTrack={onFastTrack} />
                </div>
                {onStartFresh && <StartFreshRow onStartFresh={onStartFresh} />}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </>
  )
}