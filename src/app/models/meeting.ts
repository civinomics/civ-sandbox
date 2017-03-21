import { Entity, EntityField } from './index';
import * as moment from 'moment';
import { AgendaItem } from './item';
import Moment = moment.Moment;

export type MeetingStatus = 'open' | 'closed' | 'draft'

export type MeetingField = 'title' | 'startTime' | 'endTime' | 'feedbackDeadline' | 'status' | 'items'

export interface Meeting extends Entity {
  title: string;

  startTime: Moment;
  endTime: Moment;
  feedbackDeadline: Moment;
  status: MeetingStatus;

  items: (string | AgendaItem)[]
}

export type NormalizedMeeting = {
  [P in EntityField | 'title' | 'startTime' | 'endTime' | 'feedbackDeadline' | 'status']: Meeting[P]
  } & {
  items: string[]
}


export type DenormalizedMeeting = {
  [P in EntityField | 'title' | 'startTime' | 'endTime' | 'feedbackDeadline' | 'status']: Meeting[P]
  } & {
  items: AgendaItem[]
}
