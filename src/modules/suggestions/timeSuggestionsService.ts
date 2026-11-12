import { createFirestoreService } from '../../services/firestoreService'
import { TimeSuggestion } from '../../models'

// Colección "timeSuggestions": cada persona solo lee y escribe las suyas.
export const timeSuggestionsService = createFirestoreService<TimeSuggestion>('timeSuggestions')
