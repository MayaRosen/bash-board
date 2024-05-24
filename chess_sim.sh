# Name files
file_path="capmemel24_1.pgn"
temp_moves_file="temp_moves.txt"
output_file="uci_moves.txt"

# Move the PGN moves without methada to temp_moves
sed -n '/^\[ECO/,${p}' "$file_path" | tail -n +2 > "$temp_moves_file"
sed 's/[0-9]\+\.//g' "$file_path" | tr -d '\n' | sed 's/0-1//g' > "$output_file"

# Write temp_moves and move the output of the UCI moves to output_file named uci_moves
moves=$(<"$temp_moves_file")
python3 parse-moves.py "$moves" > "$output_file"

# Print Methadata
while IFS= read -r line
do
    if [[ $line == \[*\] ]]; then
        echo "$line"
    fi
done < "$file_path"
echo ""

# Declare board variables
declare -a board
declare -a board_history
move_index=0

# Initialize the chessboard
initialize_board() {
    board=(
        [0]="  r n b q k b n r"
        [1]="  p p p p p p p p"
        [6]="  P P P P P P P P"
        [7]="  R N B Q K B N R"
    )
    for i in {2..5}; do
        board[$i]="  • • • • • • • •"
    done
    board_history=()
    move_index=0
    save_board_state
}

# Print board
print_board() {
    echo "Move ${move_index}/114"
    echo "  a b c d e f g h"
    for i in {0..7}; do
        echo "$((8-i))${board[$i]} $((8-i))"
    done
    echo " a b c d e f g h"
}


# Save current board state to history
save_board_state() {
    board_state=("${board[@]}")
    board_history+=("$(IFS=$'\n'; echo "${board_state[*]}")")
}

# Load the last board state from history
load_board_state() {
    if [ ${#board_history[@]} -gt 0 ]; then
        last_state="${board_history[-1]}"
        IFS=$'\n' read -r -d '' -a board <<< "$last_state"
    fi
}

# Convert chess to array
convert_to_index() {
    local pos=$1
    local col=${pos:0:1}
    local row=${pos:1:1}
    local col_index=$(( $(printf "%d" "'$col") - 97 ))
    local row_index=$((8 - row))
    echo "$row_index $col_index"
}

# Move piece
move_piece() {
    local move=$1
    local from="${move:0:2}"
    local to="${move:2:2}"

    read from_row from_col <<< $(convert_to_index "$from")
    read to_row to_col <<< $(convert_to_index "$to")

    local from_pos=$((from_col * 2 + 2))
    local to_pos=$((to_col * 2 + 2))

    local piece="${board[$from_row]:$from_pos:1}"
    board[$from_row]="${board[$from_row]:0:$from_pos}•${board[$from_row]:$((from_pos + 1))}"
    board[$to_row]="${board[$to_row]:0:$to_pos}$piece${board[$to_row]:$((to_pos + 1))}"

    save_board_state
}

# Move one step forward
move_step_forward() {
    # Read all moves into an array
    mapfile -t moves < <(tr ' ' '\n' < "$output_file")

    if [ $move_index -lt ${#moves[@]} ]; then
        next_move="${moves[$move_index]}"
        move_piece "$next_move"
        ((move_index++))
        print_board
    else
        echo "No more moves available."
    fi
}

go_to_end() {
    # Read all moves into an array
    mapfile -t moves < <(tr ' ' '\n' < "$output_file")


    while [ $move_index -lt ${#moves[@]} ]; do
        next_move="${moves[$move_index]}"
        move_piece "$next_move"
        ((move_index++))
    done

    print_board
}

# Move one step backward
move_step_backward() {
    if [ $move_index -gt 0 ]; then
        ((move_index--))
        unset 'board_history[-1]'
        load_board_state
    fi
}

# Print the initial board
initialize_board
print_board
run=0;

# While loop of the chess game
while [ $run -eq 0 ]; do
    echo "Press 'd' to move forward, 'a' to move back, 'w' to go to the start, 's' to go to the end, 'q' to quit:"
    read -r key

    case $key in
        d)
            move_step_forward
            ;;
        a)
            move_step_backward
            print_board
            ;;
        w)
            initialize_board
            print_board
            ;;
        s)
            go_to_end
            print_board
            ;;
        q)
            echo "Exiting."
            run=1
            ;;
        *)
            echo "Invalid key pressed: $key"
    esac
done

