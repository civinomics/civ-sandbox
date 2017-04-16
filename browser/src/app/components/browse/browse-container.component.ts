import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Meeting } from '../../meeting/meeting.model';
import { Item } from '../../models/item';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { AppState } from '../../reducers/index';
import { Group } from '../../group/group';
import { GroupService } from '../../group/group.service';
import { MeetingService } from '../../meeting/meeting.service';
import { ItemService } from '../../services/item.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'civ-browse-container',
  templateUrl: './browse-container.component.html',
  styleUrls: [ './browse-container.component.scss' ],
  animations: [
    trigger('travBar', [
      state('hidden', style({ height: 0 })),
      state('shown', style({ height: '*' })),
      transition('hidden => shown', animate('150ms ease-in')),
      transition('shown => hidden', animate('150ms 350ms ease-in'))

    ]),
    trigger('travEl', [
      state('void', style({ opacity: 0 })),
      state('*', style({ opacity: 1 })),
      transition('void => *', animate('150ms 200ms ease-in')),
      transition('* => void', animate('150ms 100ms ease-in'))


    ])
  ]
})
export class BrowseContainerComponent implements OnInit, OnChanges {
  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
  }


  focusedGroup$: Observable<Group | null>;
  focusedMeeting$: Observable<Meeting | null>;
  focusedItem$: Observable<Item | null>;

  showTravBar: Observable<boolean>;

  constructor(private store: Store<AppState>, private groupSvc: GroupService, private meetingSvc: MeetingService, private itemSvc: ItemService,
              private router: Router,
              private route: ActivatedRoute) {


    const focus = route.firstChild.params.map(params => ({
      group: params['groupId'],
      meeting: params['meetingId'],
      item: params['itemId']
    }))
      .distinctUntilChanged((x, y) => x.group == y.group && x.meeting == y.meeting && x.item == y.item);

    this.focusedGroup$ = groupSvc.getSelectedGroup();
    this.focusedMeeting$ = meetingSvc.getSelectedMeeting();
    this.focusedItem$ = itemSvc.getSelectedItem();


    focus.subscribe(it => console.log(it));
    route.firstChild.params.subscribe(it => console.log(it));
    this.focusedGroup$.subscribe(it => console.log(it));

    this.showTravBar = this.focusedMeeting$.map(it => !!it);
  }

  ngOnInit() {
  }

}
