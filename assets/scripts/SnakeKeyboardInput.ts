import { EventKeyboard, input, Input, KeyCode, Vec3 } from 'cc';

/**
 * 蛇键盘输入控制器：
 * 1. 负责注册与注销 WASD 键盘监听；
 * 2. 维护当前蛇头移动方向；
 * 3. 保持“释放当前方向键才停止”的输入语义。
 */
export class SnakeKeyboardInput {
    private readonly _moveDirection: Vec3 = new Vec3(0, 0, 0);
    private _isBound = false;

    /**
     * 获取当前移动方向。
     */
    public get moveDirection(): Readonly<Vec3> {
        return this._moveDirection;
    }

    /**
     * 注册键盘输入监听。
     */
    public bind(): void {
        if (this._isBound) {
            return;
        }

        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        this._isBound = true;
    }

    /**
     * 注销键盘输入监听。
     */
    public unbind(): void {
        if (!this._isBound) {
            return;
        }

        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        this._isBound = false;
    }

    /**
     * 清空当前移动方向。
     */
    public resetDirection(): void {
        this._moveDirection.set(0, 0, 0);
    }

    /**
     * 处理键盘按下事件，并更新移动方向。
     * @param event 键盘事件
     */
    private onKeyDown(event: EventKeyboard): void {
        switch (event.keyCode) {
            case KeyCode.KEY_W:
                this._moveDirection.set(0, 1, 0);
                break;
            case KeyCode.KEY_S:
                this._moveDirection.set(0, -1, 0);
                break;
            case KeyCode.KEY_A:
                this._moveDirection.set(-1, 0, 0);
                break;
            case KeyCode.KEY_D:
                this._moveDirection.set(1, 0, 0);
                break;
        }
    }

    /**
     * 处理键盘抬起事件，仅在抬起当前方向按键时停止移动。
     * @param event 键盘事件
     */
    private onKeyUp(event: EventKeyboard): void {
        // 只在释放“当前生效方向”对应的按键时停止，避免多键切换时误停。
        if (event.keyCode === KeyCode.KEY_W && this._moveDirection.y > 0) {
            this._moveDirection.set(0, 0, 0);
            return;
        }

        if (event.keyCode === KeyCode.KEY_S && this._moveDirection.y < 0) {
            this._moveDirection.set(0, 0, 0);
            return;
        }

        if (event.keyCode === KeyCode.KEY_A && this._moveDirection.x < 0) {
            this._moveDirection.set(0, 0, 0);
            return;
        }

        if (event.keyCode === KeyCode.KEY_D && this._moveDirection.x > 0) {
            this._moveDirection.set(0, 0, 0);
        }
    }
}
