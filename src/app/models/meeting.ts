import {Entity, EntityField, parseEntity, RawEntity} from './index';
import * as moment from 'moment';
import {keys} from 'lodash';
import {ItemStatsAdt} from './item';
import Moment = moment.Moment;

export type MeetingStatus = 'open' | 'closed' | 'draft'

export type MeetingField = 'title' | 'startTime' | 'endTime' | 'feedbackDeadline' | 'status' | 'agendaIds'

export interface Meeting extends Entity {
  title: string;
  startTime: Moment;
  endTime: Moment;
  feedbackDeadline: Moment;
  status: MeetingStatus;
  agendaIds: string[];
  groupId: string;
}


export type RawMeeting = RawEntity & {
  [P in EntityField | 'title' | 'status' | 'groupId']: Meeting[P];
  } & {
  [P in 'startTime' | 'endTime' | 'feedbackDeadline']: string;
  } & {
  agenda: string[]
}


export type MeetingStatsAdt = {

  total: {
    votes: number;
    comments: number;
    participants: number;
    byDistrict: {
      [id: string]: {
        votes: number;
        comments: number;
        participants: number;
      }
    };
  };

  byItem: {
    [itemId: string]: {
      total: ItemStatsAdt;
      byDistrict: { [districtId: string]: ItemStatsAdt }
    }
  }


}

export const parseMeeting: (data: RawMeeting) => Meeting = (data: RawMeeting) => {

  return {
    ...parseEntity(data),
    id: data.$key,
    title: data.title,
    groupId: data.groupId,
    status: moment(data.feedbackDeadline).isAfter(moment()) ? 'open' : 'closed',
    startTime: moment(data.startTime),
    endTime: moment(data.endTime),
    feedbackDeadline: moment(data.feedbackDeadline),
    agendaIds: keys(data.agenda)
  }
};

export const meetingsEqual: (x: Meeting, y: Meeting) => boolean = (x, y) => {
  if (x.id != y.id || x.title != y.title || x.status != y.status) {
    return false;
  }
  if (x.agendaIds.join('_') != y.agendaIds.join('_')) {
    return false;
  }
  return true;
};

export const mergeMeetings: (prev: Meeting, next: Meeting) => Meeting = (prev, next) => {
  return {
    ...prev, ...next
  }
};
