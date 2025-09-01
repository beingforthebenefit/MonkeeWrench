import {EventEmitter} from 'events'

class Bus extends EventEmitter {}
export const bus = new Bus()

export const EVENTS = {
  PROPOSAL_UPDATED: 'proposal.updated',
  PROPOSAL_CREATED: 'proposal.created',
} as const
