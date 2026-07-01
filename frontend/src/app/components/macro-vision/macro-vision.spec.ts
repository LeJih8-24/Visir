import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MacroVision } from './macro-vision';

describe('MacroVision', () => {
  let component: MacroVision;
  let fixture: ComponentFixture<MacroVision>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MacroVision],
    }).compileComponents();

    fixture = TestBed.createComponent(MacroVision);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
