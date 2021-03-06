import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { SessionUser, User } from '../../user/user.model';
import { AuthService } from '../../user/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { GroupService } from '../../group/group.service';
import { GroupCreateInput, GroupEditInput } from '../../group/group.model';

@Component({
  selector: 'civ-group-edit-page',
  template: `
    <civ-group-edit-view [adminSearchResult]="adminSearchResult$ | async"
                         [savePending]="savePending"
                         [authUser]="authUser$ | async"
                         (adminEmailChanged)="adminEmailQuery$.next($event)"
                         (create)="submit($event)"
                         (save)="saveChanges($event)"
                         [error]="error"
    ></civ-group-edit-view>
  `,
  styles: []
})
export class GroupEditPageComponent implements OnInit {

  adminEmailQuery$: Subject<string> = new BehaviorSubject('');
  adminSearchResult$: Observable<User | null>;
  error: string = '';
  savePending: boolean = false;

  authUser$: Observable<SessionUser>;

  constructor(private authSvc: AuthService, private router: Router, private route: ActivatedRoute, private groupSvc: GroupService) {
    this.adminSearchResult$ = this.authSvc.getUserByEmail(
      this.adminEmailQuery$.skip(1).debounceTime(500)
    );

    this.authUser$ = this.authSvc.sessionUser$;

  }

  ngOnInit() {

  }

  submit(input: GroupCreateInput) {
    this.savePending = true;

    if (!input.adminId) {
      this.authSvc.requestAuthModal('We need you to sign in to create a group.');
    }

    this.groupSvc.createGroup(input).subscribe(result => {
      this.savePending = false;
      if (result.success == true) {
        this.router.navigate([ 'group', result.groupId, 'admin' ]);
      } else {
        this.error = result.error;
      }
    }, err => {
      this.error = err.message;
    })
  }

  saveChanges(input: GroupEditInput) {
    this.groupSvc.saveChanges(input);
  }

}
