import { useLocation } from 'react-router-dom'

export default function SearchLocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}
