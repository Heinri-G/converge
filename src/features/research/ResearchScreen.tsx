import { GateWizard } from '@/features/stage-gate/GateWizard'
import { useSearchParams } from 'react-router-dom'

export default function ResearchScreen() {
  const [searchParams] = useSearchParams()
  const prompt = searchParams.get('prompt') ?? undefined
  const fastTrack = searchParams.get('fastTrack') === '1'

  return prompt ? (
    <GateWizard initialPrompt={prompt} fastTrack={fastTrack} />
  ) : (
    <GateWizard fastTrack={fastTrack} />
  )
}
