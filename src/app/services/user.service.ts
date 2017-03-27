import { Injectable } from '@angular/core';
import { AngularFireAuth, AngularFireDatabase, AuthMethods, AuthProviders, FirebaseAuthState } from 'angularfire2';
import { Observable } from 'rxjs';
import { SessionUser, UserAddress } from '../models/user';
import { FirebaseError } from 'firebase/app';
import {
  AUTH_ERRORED,
  AUTH_STATE_CHANGED,
  AuthErroredAction,
  AuthStateChangedAction,
  SESSION_USER_LOADED,
  SessionUserLoadedAction
} from '../reducers/auth';
import { Store } from '@ngrx/store';
import { AppState, getSessionUserId } from '../reducers/index';
import { Actions, Effect, toPayload } from '@ngrx/effects';

export type SocialAuthProvider = 'facebook' | 'twitter' | 'google';

@Injectable()
export class UserService {

  @Effect()
  loadSessionUserDataEffect: Observable<SessionUserLoadedAction> = this.actions.ofType(AUTH_STATE_CHANGED)
    .map(toPayload)
    .filter(state => !!state && !!state.uid)
    .do(it => {
      console.debug(`initiating loadSessinUserData`);
      console.debug(it);
    })
    .map(state => state.uid)
    .flatMap(id =>
      Observable.combineLatest(this.db.object(`/user_public/${id}`), this.db.object(`/user_private/${id}`))
      //make sure we end the subscription when the user logs out to avoid 401
        .takeUntil(this.actions.ofType(AUTH_STATE_CHANGED)
          .map(toPayload)
          .filter(it => !it || !it.uid))
        .map(([ publicData, privateData ]) => ({ ...publicData, ...privateData } as SessionUser))
    ).map(user => new SessionUserLoadedAction(user));


  public readonly sessionUser$: Observable<SessionUser | null>;
  public readonly sessionUserId$: Observable<string | null>;


  constructor(private authBackend: AngularFireAuth,
              private db: AngularFireDatabase,
              private store: Store<AppState>,
              private actions: Actions) {


    this.authBackend
      .distinctUntilChanged()
      .subscribe(state => {
        console.log(state);
        this.store.dispatch(new AuthStateChangedAction(state));
      });

    this.sessionUserId$ = this.store.select(getSessionUserId);

  }

  public logout() {
    this.authBackend.logout();
  }

  public socialSignIn(provider: SocialAuthProvider): Observable<FirebaseAuthState> {
    this.doSocialLogin(provider);

    return this.actions.ofType(AUTH_STATE_CHANGED)
      .map(action => action.payload)
      .filter(auth => !!auth && !!auth.auth)
      .takeUntil(this.actions.ofType(AUTH_ERRORED));
  }

  public completeSocialSignin(data: UserAddress): Observable<SessionUser> {
    this.sessionUserId$.take(1).subscribe(id => {
      if (!id) {
        throw `Attempted to complete social signin while no sessionUserId exists`;
      }

      this.db.object(`/user_private/${id}`).update({ address: data }).then(res => {
        console.debug(`successfully updated user_private/${id}`);
      });
    });

    return this.actions.ofType(SESSION_USER_LOADED)
      .take(1);

  }


  private doSocialLogin(provider: SocialAuthProvider): void {
    let arg = provider == 'facebook' ? {
      provider: providerMap[ provider ],
      method: AuthMethods.Popup,
      scope: [ 'email' ]
    } : {
      provider: providerMap[ provider ],
      method: AuthMethods.Popup,
    };
    this.authBackend.login(arg).then((it: FirebaseAuthState) => {

    }).catch((err: FirebaseError) => {
      this.store.dispatch(new AuthErroredAction(err));
    });
  }


  private loadSessionUser() {


  }


}


const providerMap: { [x: string]: AuthProviders } = {
  'facebook': AuthProviders.Facebook,
  'twitter': AuthProviders.Twitter,
  'google': AuthProviders.Google,
};